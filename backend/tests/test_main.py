import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_greet_success():
    response = client.post("/greet", json={"name": "Alice"})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, Alice!"}

def test_greet_empty_name():
    response = client.post("/greet", json={"name": "   "})
    assert response.status_code == 400