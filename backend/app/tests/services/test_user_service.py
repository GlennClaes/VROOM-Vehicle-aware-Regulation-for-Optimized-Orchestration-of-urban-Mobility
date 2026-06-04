import pytest
from sqlmodel import Session, create_engine, SQLModel
from sqlmodel.pool import StaticPool
from app.services import user_service
from app.schemas.user import UserCreate

from app.core.security import verify_password

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

def test_create_user_service(session: Session):
    user = user_service.create_user(session, "serviceuser", "service@vroom.ai", "password")
    assert user.username == "serviceuser"
    assert user.email == "service@vroom.ai"
    assert hasattr(user, "hashed_password")

def test_get_user_by_email(session: Session):
    user_service.create_user(session, "findme", "find@vroom.ai", "password")
    user = user_service.get_user_by_email(session, "find@vroom.ai")
    assert user is not None
    assert user.username == "findme"

def test_authenticate_user_success(session: Session):
    user_service.create_user(session, "authuser", "auth@vroom.ai", "correct")
    user = user_service.get_user_by_username(session, "authuser")
    assert user is not None
    assert verify_password("correct", user.hashed_password) is True

def test_authenticate_user_fail(session: Session):
    user_service.create_user(session, "failuser", "fail@vroom.ai", "correct")
    user = user_service.get_user_by_username(session, "failuser")
    assert user is not None
    assert verify_password("wrong", user.hashed_password) is False

def test_delete_user_success(session: Session):
    user_service.create_user(session, "delete_me", "delete@vroom.ai", "password")
    result = user_service.delete_user_by_username(session, "delete_me")
    assert result == 1
    assert user_service.get_user_by_username(session, "delete_me") is None

def test_delete_user_fail(session: Session):
    result = user_service.delete_user_by_username(session, "nonexistent")
    assert result == 0
