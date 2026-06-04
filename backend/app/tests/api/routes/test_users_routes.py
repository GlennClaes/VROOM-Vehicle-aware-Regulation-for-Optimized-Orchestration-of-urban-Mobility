import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from datetime import datetime

from app.main import app
from app.core.security import get_current_user
from app.db.session import get_session

client = TestClient(app)


class FakeUser:
    def __init__(self):
        self.id = 1
        self.username = "testuser"
        self.email = "test@test.com"
        self.created_at = datetime(2024, 1, 1)
        self.last_login_at = datetime(2024, 1, 2)
        self.hashed_password = "hashed"
        self.updated_at = None


@pytest.fixture
def override_user():
    def _override():
        return (FakeUser(), None)

    app.dependency_overrides[get_current_user] = _override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def override_session():
    session = MagicMock()
    session.add = MagicMock()
    session.commit = MagicMock()
    session.refresh = MagicMock()

    def _override():
        return session

    app.dependency_overrides[get_session] = _override
    yield session
    app.dependency_overrides.pop(get_session, None)


# ---------------------------
# /users/me
# ---------------------------

def test_get_me_success(override_user):
    response = client.get("/users/me")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == "user_1"
    assert data["username"] == "testuser"
    assert data["email"] == "test@test.com"


# ---------------------------
# update username success
# ---------------------------

@patch("app.api.routes.users.get_user_by_username")
@patch("app.api.routes.users.create_access_token")
def test_update_username_success(mock_token, mock_get_username, override_user, override_session):

    mock_get_username.return_value = None
    mock_token.return_value = "newtoken"

    response = client.put(
        "/users/update",
        json={"username": "newname"}
    )

    assert response.status_code == 200
    data = response.json()

    assert data["access_token"] == "newtoken"


# ---------------------------
# username exists
# ---------------------------

@patch("app.api.routes.users.get_user_by_username")
def test_update_username_exists(mock_get_username, override_user, override_session):

    other = MagicMock()
    other.id = 2
    mock_get_username.return_value = other

    response = client.put(
        "/users/update",
        json={"username": "taken"}
    )

    assert response.status_code == 400

# ---------------------------
# email exists
# ---------------------------

@patch("app.api.routes.users.get_user_by_email")
def test_update_email_exists(mock_get_email, override_user, override_session):
    other = MagicMock()
    other.id = 2
    mock_get_email.return_value = other

    response = client.put(
        "/users/update",
        json={"email": "taken@test.com"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "E-mailadres is al in gebruik"

# ---------------------------
# password update missing current
# ---------------------------

def test_update_password_missing_current(override_user, override_session):
    response = client.put(
        "/users/update",
        json={"password": "newpassword123"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Huidig wachtwoord is vereist"

# ---------------------------
# password update incorrect current
# ---------------------------

@patch("app.api.routes.users.verify_password")
def test_update_password_incorrect_current(mock_verify, override_user, override_session):
    mock_verify.return_value = False
    response = client.put(
        "/users/update",
        json={"password": "newpassword123", "current_password": "wrong"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Huidig wachtwoord is incorrect"

# ---------------------------
# password update success
# ---------------------------

@patch("app.api.routes.users.verify_password")
@patch("app.api.routes.users.validate_password")
@patch("app.api.routes.users.hash_password")
def test_update_password_success(mock_hash, mock_validate, mock_verify, override_user, override_session):
    mock_verify.return_value = True
    mock_hash.return_value = "new_hashed"
    
    response = client.put(
        "/users/update",
        json={"password": "validPassword123!", "current_password": "correct"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Profiel succesvol bijgewerkt"