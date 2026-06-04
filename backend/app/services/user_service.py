from sqlmodel import Session, select
from app.db.models import User
from app.core.security import hash_password

def get_user_by_username(session: Session, username: str):
    statement = select(User).where(User.username == username)
    return session.exec(statement).first()

def get_user_by_email(session: Session, email: str):
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()

def create_user(session: Session, username: str, email: str, password: str):
    hashed_pw = hash_password(password)
    user = User(username=username, email=email, hashed_password=hashed_pw, disabled=False)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def delete_user_by_username(session: Session, username: str) -> int:
    user = get_user_by_username(session, username)
    if user:
        session.delete(user)
        session.commit()
        return 1
    return 0
