def test_register_success(client):
    response = client.post("/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "secret123"
    })
    assert response.status_code == 200
    assert response.json()["message"] == "User is succesvol aangemaakt"

def test_register_duplicate_username(client):
    client.post("/register", json={
        "username": "dupuser",
        "email": "dup@example.com",
        "password": "secret123"
    })

    response = client.post("/register", json={
        "username": "dupuser",
        "email": "another@example.com",
        "password": "secret123"
    })

    assert response.status_code == 400

def test_register_duplicate_email(client):
    client.post("/register", json={
        "username": "user1",
        "email": "dup@example.com",
        "password": "secret123"
    })

    response = client.post("/register", json={
        "username": "user2",
        "email": "dup@example.com",
        "password": "secret123"
    })

    assert response.status_code == 400

def test_register_short_password(client):
    response = client.post("/register", json={
        "username": "shortpw",
        "email": "short@example.com",
        "password": "123"
    })

    assert response.status_code == 400

def test_login_success_with_email(client):
    # Eerst user registreren
    client.post("/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "secret123"
    })

    response = client.post("/login", json={
        "email": "login@example.com",
        "password": "secret123"
    })

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"

def test_login_success_with_email_v2(client):
    # Eerst user registreren
    client.post("/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "secret123"
    })

    response = client.post("/login", json={
        "email": "login@example.com",
        "password": "secret123"
    })

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/register", json={
        "username": "wrongpw",
        "email": "wrong@example.com",
        "password": "secret123"
    })

    response = client.post("/login", json={
        "email": "wrong@example.com",
        "password": "wrongpassword"
    })

    assert response.status_code == 400
    assert response.json()["detail"] == "Onjuist e-mailadres of wachtwoord"


def test_login_user_not_found(client):
    response = client.post("/login", json={
        "email": "doesnotexist@example.com",
        "password": "secret123"
    })

    assert response.status_code == 400

def test_logout_success(client):
    """Inloggen en daarna uitloggen moet 200 teruggeven."""
    client.post("/register", json={
        "username": "logoutuser",
        "email": "logout@example.com",
        "password": "secret123"
    })

    login_response = client.post("/login", json={
        "email": "logout@example.com",
        "password": "secret123"
    })
    token = login_response.json()["access_token"]

    response = client.post(
        "/logout",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Succesvol uitgelogd"


def test_logout_token_is_blacklisted(client):
    """Na uitloggen mag het token niet meer werken voor beveiligde endpoints."""
    client.post("/register", json={
        "username": "blacklistuser",
        "email": "blacklist@example.com",
        "password": "secret123"
    })

    login_response = client.post("/login", json={
        "email": "blacklist@example.com",
        "password": "secret123"
    })
    token = login_response.json()["access_token"]

    # Uitloggen
    client.post("/logout", headers={"Authorization": f"Bearer {token}"})

    # Zelfde token opnieuw gebruiken moet 401 geven
    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "logged out" in response.json()["detail"].lower()


def test_logout_without_token(client):
    """Uitloggen zonder token moet 401 teruggeven."""
    response = client.post("/logout")
    assert response.status_code == 401


def test_logout_with_invalid_token(client):
    """Uitloggen met een ongeldig token moet 401 teruggeven."""
    response = client.post(
        "/logout",
        headers={"Authorization": "Bearer ongeldigtoken"}
    )
    assert response.status_code == 401


def test_logout_twice_same_token(client):
    """Twee keer uitloggen met hetzelfde token — tweede poging geeft 401."""
    client.post("/register", json={
        "username": "doublelogout",
        "email": "double@example.com",
        "password": "secret123"
    })

    login_response = client.post("/login", json={
        "email": "double@example.com",
        "password": "secret123"
    })
    token = login_response.json()["access_token"]

    client.post("/logout", headers={"Authorization": f"Bearer {token}"})

    response = client.post("/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_blacklist_token_function():
    """Unit test voor blacklist functies in security module."""
    from app.core.security import blacklist_token, is_token_blacklisted, token_blacklist

    test_token = "test.token.abc"
    token_blacklist.discard(test_token)  # schoon beginnen

    assert not is_token_blacklisted(test_token)
    blacklist_token(test_token)
    assert is_token_blacklisted(test_token)

    token_blacklist.discard(test_token)  # opruimen
