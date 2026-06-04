from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from datetime import datetime, timezone, timedelta

from app.schemas.user import UserUpdate
from app.services.user_service import get_user_by_username, get_user_by_email
from app.db.session import get_session
from app.core.security import verify_password, hash_password, validate_password, get_current_user, create_access_token
from app.core.config import settings

router = APIRouter(tags=["Users"])


# ---------------------------
# Get current user details
# ---------------------------
@router.get("/users/me", response_model=dict)
def get_me(current: tuple = Depends(get_current_user)):
    user, _ = current
    return {
        "id": f"user_{user.id}",
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.replace(tzinfo=timezone.utc).isoformat(),
        "last_sign_in_at": user.last_login_at.replace(tzinfo=timezone.utc).isoformat() if user.last_login_at else None,
    }


# ---------------------------
# Update user
# ---------------------------
@router.put("/users/update", response_model=dict)
def update_user(
        user_data: UserUpdate,
        current: tuple = Depends(get_current_user),
        session: Session = Depends(get_session)
):
    user, _ = current
    updated = False

    if user_data.username and user_data.username != user.username:
        existing = get_user_by_username(session, user_data.username)
        if existing and existing.id != user.id:
            raise HTTPException(status_code=400, detail="Gebruikersnaam is al in gebruik")
        user.username = user_data.username
        updated = True

    if user_data.email and user_data.email != user.email:
        existing = get_user_by_email(session, user_data.email)
        if existing and existing.id != user.id:
            raise HTTPException(status_code=400, detail="E-mailadres is al in gebruik")
        user.email = user_data.email
        updated = True

    if user_data.password:
        if not user_data.current_password:
            raise HTTPException(status_code=400, detail="Huidig wachtwoord is vereist")
        if not verify_password(user_data.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Huidig wachtwoord is incorrect")
        validate_password(user_data.password)
        user.hashed_password = hash_password(user_data.password)
        updated = True

    if updated:
        user.updated_at = datetime.utcnow()
        session.add(user)
        session.commit()
        session.refresh(user)

    # Geef altijd een nieuw token terug zodat de sub klopt met de nieuwe username
    new_token = create_access_token(
        {"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "message": "Profiel succesvol bijgewerkt" if updated else "Geen wijzigingen aangebracht",
        "access_token": new_token,
        "token_type": "bearer"
    }
