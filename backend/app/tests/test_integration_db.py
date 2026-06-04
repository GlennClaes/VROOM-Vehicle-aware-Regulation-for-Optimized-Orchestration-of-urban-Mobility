import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.db.session import get_session
from app.schemas.user import UserCreate
from app.services import user_service

# Gebruik een in-memory SQLite database voor integratietests
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_create_user_and_login_integration(client: TestClient, session: Session):
    """
    Integratietest: Maakt een echte gebruiker aan in de SQLite DB en probeert in te loggen.
    Controleert of de database-laag, service-laag en API-laag correct samenwerken.
    """
    # 1. Registreer een nieuwe gebruiker via de API
    user_data = {
        "username": "testpro",
        "email": "pro@vroom.ai",
        "password": "strongpassword123"
    }
    response = client.post("/register", json=user_data)
    assert response.status_code == 200, f"Signup mislukt: {response.text}"
    
    # 2. Controleer of de gebruiker echt in de database staat
    from app.db.models import User
    from sqlmodel import select
    db_user = session.exec(select(User).where(User.username == "testpro")).first()
    assert db_user is not None
    assert db_user.email == "pro@vroom.ai"

    # 3. Probeer in te loggen via de OAuth2 flow
    login_data = {
        "email": "testpro",
        "password": "strongpassword123"
    }
    # OAuth2 verwacht hier JSON omdat we de UserLogin schema gebruiken in de route
    response = client.post("/login", json=login_data)
    assert response.status_code == 200
    
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

def test_get_own_profile_integration(client: TestClient):
    """Controleert of een ingelogde gebruiker zijn eigen gegevens kan ophalen."""
    # Setup: Gebruiker aanmaken en inloggen
    client.post("/register", json={
        "username": "profileuser",
        "email": "profile@vroom.ai",
        "password": "password"
    })
    login_resp = client.post("/login", json={"email": "profileuser", "password": "password"})
    token = login_resp.json()["access_token"]

    # Request met token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/users/me", headers=headers)
    
    assert response.status_code == 200
    assert response.json()["username"] == "profileuser"
