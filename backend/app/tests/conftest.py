import os
# EERST env vars zetten, vóór app imports
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-voor-pytest")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

import pytest # noqa: E402
from sqlmodel import SQLModel, create_engine, Session # noqa: E402
from sqlmodel.pool import StaticPool # noqa: E402
from fastapi.testclient import TestClient # noqa: E402
from app.main import app # noqa: E402
from app.db.session import get_session # noqa: E402

# In-memory SQLite zodat tests niets achterlaten op schijf
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
