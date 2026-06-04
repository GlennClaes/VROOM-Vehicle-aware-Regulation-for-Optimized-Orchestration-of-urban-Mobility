from fastapi.testclient import TestClient
from app.main import app
import pytest

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_lifespan_execution():
    # Test that the lifespan context manager can be executed
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
