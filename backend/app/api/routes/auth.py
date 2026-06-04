from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from datetime import timedelta, datetime

from app.schemas.user import UserCreate, UserLogin, Message, Token
from app.services.user_service import (
    get_user_by_username,
    get_user_by_email,
    create_user
)
from app.db.session import get_session
from app.core.security import (
    verify_password,
    create_access_token,
    validate_password,
    get_current_user,
    blacklist_token,
)
from app.core.config import settings

router = APIRouter(tags=["Authentication"])


# ---------------------------
# Register
# ---------------------------
@router.post(
    "/register",
    response_model=Message,
    summary="Register a new user",
    description="Create a new user account by providing a unique username, email, and password. "
                "Passwords must meet the security requirements."
)
def register(user_data: UserCreate, session: Session = Depends(get_session)):
    if get_user_by_username(session, user_data.username):
        raise HTTPException(status_code=400, detail="Username is al in gebruik")
    if get_user_by_email(session, user_data.email):
        raise HTTPException(status_code=400, detail="Email is al in gebruik")

    validate_password(user_data.password)
    create_user(session, user_data.username, user_data.email, user_data.password)

    return {"message": "User is succesvol aangemaakt"}


# ---------------------------
# Login
# ---------------------------
@router.post(
    "/login",
    response_model=Token,
    summary="User login",
    description="Authenticate a user using email and password. Returns a JWT access token on success."
)
def login(user_data: UserLogin, session: Session = Depends(get_session)):
    if "@" in user_data.email:
        user = get_user_by_email(session, user_data.email)
    else:
        user = get_user_by_username(session, user_data.email)

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Onjuist e-mailadres of wachtwoord")

    # Sla UTC op in de DB
    user.last_login_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)

    access_token = create_access_token(
        {"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer"}


# ---------------------------
# Logout (echte blacklist)
# ---------------------------
@router.post("/logout", response_model=Message, summary="User logout",
             description="Logout a user.")
def logout(current: tuple = Depends(get_current_user)):
    _, token = current
    blacklist_token(token)
    return {"message": "Succesvol uitgelogd"}


@router.get("/me", response_model=dict, summary="Get current user")
def me(current: tuple = Depends(get_current_user)):
    user, _ = current
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }
