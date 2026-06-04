import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.routes import rl as rl_module
from app.api.routes.rl import _state

client = TestClient(app)

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_state():
    """Reset globale state voor en na elke test."""
    _state.training_active  = False
    _state.training_episode = 0
    _state.training_total   = 0
    _state.training_error   = None
    _state.inference_active = False
    _state.inference_error  = None
    rl_module._shared_agent = None   # ← ook agent resetten!
    yield
    _state.training_active  = False
    _state.inference_active = False
    rl_module._shared_agent = None


# ── Models ────────────────────────────────────────────────────────────────────

def test_list_models_empty(tmp_path):
    nonexistent = tmp_path / "no_models_here"
    with patch.object(rl_module, "MODELS_DIR", nonexistent):
        response = client.get("/rl/models")
    assert response.status_code == 200
    assert response.json() == []


def test_list_models_with_files(tmp_path):
    (tmp_path / "dqn_test.pt").write_bytes(b"x" * 1024)
    with patch.object(rl_module, "MODELS_DIR", tmp_path):
        response = client.get("/rl/models")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_delete_model_not_found():
    response = client.delete("/rl/models/nonexistent.pt")
    assert response.status_code == 404


def test_delete_model_success(tmp_path):
    model = tmp_path / "dqn_test.pt"
    model.write_bytes(b"w")
    with patch.object(rl_module, "MODELS_DIR", tmp_path):
        response = client.delete("/rl/models/dqn_test.pt")
    assert response.status_code == 200
    assert not model.exists()


# ── Training ──────────────────────────────────────────────────────────────────

def test_training_status_all_fields():
    _state.training_total   = 100
    _state.training_episode = 40
    response = client.get("/rl/training/status")
    assert response.status_code == 200
    data = response.json()
    assert data["progress_pct"] == 40.0
    for field in ["active", "episode", "total", "reward", "epsilon",
                  "avg_queue", "loss", "started", "error"]:
        assert field in data


def test_start_training_already_active():
    _state.training_active = True
    assert client.post("/rl/training/start", json={"episodes": 5}).status_code == 400


def test_start_training_inference_active():
    _state.inference_active = True
    assert client.post("/rl/training/start", json={"episodes": 5}).status_code == 400


def test_start_training_success(tmp_path):
    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("threading.Thread") as mock_thread:
        mock_thread.return_value.start = MagicMock()
        response = client.post("/rl/training/start", json={"episodes": 5})
    assert response.status_code == 200
    assert response.json()["status"] == "training gestart"


def test_start_training_resumes_latest_model(tmp_path):
    """Als geen model_path opgegeven → pikt meest recente final op."""
    (tmp_path / "dqn_20240101_120000_final.pt").write_bytes(b"w")
    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("threading.Thread") as mock_thread:
        mock_thread.return_value.start = MagicMock()
        response = client.post("/rl/training/start", json={"episodes": 2})
    assert response.status_code == 200
    assert "final" in response.json()["resumed_from"]


def test_stop_training_not_active():
    assert client.post("/rl/training/stop").status_code == 400


def test_stop_training_success():
    _state.training_active = True
    response = client.post("/rl/training/stop")
    assert response.status_code == 200
    assert _state.training_active is False


def test_training_log_empty(tmp_path):
    with patch.object(rl_module, "LOGS_DIR", tmp_path):
        response = client.get("/rl/training/log")
    assert response.status_code == 200
    assert response.json() == []


def test_training_log_with_data(tmp_path):
    log_data = [{"episode": 1, "reward": 10.0}]
    (tmp_path / "training_log.json").write_text(json.dumps(log_data))
    with patch.object(rl_module, "LOGS_DIR", tmp_path):
        response = client.get("/rl/training/log")
    assert response.json() == log_data


# ── _run_training (direct, zonder thread) ────────────────────────────────────

def test_run_training_full_loop(tmp_path):
    """Roep _run_training direct aan met gemockte env en agent."""
    mock_env = MagicMock()
    mock_env.reset.return_value = ([0.0] * 48, {})
    mock_env.step.return_value  = ([0.0] * 48, 1.0, True, False, {"total_queue": 2})

    mock_agent = MagicMock()
    mock_agent.epsilon      = 0.5
    mock_agent.train_step.return_value = 0.01
    mock_agent.select_action.return_value = 0

    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("rl.dqn_agent.DQNAgent", return_value=mock_agent), \
         patch("app.api.routes.rl._make_env", return_value=mock_env):
        _state.training_active = True
        rl_module._run_training(episodes=2, model_path=None)

    assert not _state.training_active
    assert _state.training_episode == 2


def test_run_training_with_existing_model(tmp_path):
    model_file = tmp_path / "existing.pt"
    model_file.write_bytes(b"w")

    mock_env   = MagicMock()
    mock_env.reset.return_value = ([0.0] * 48, {})
    mock_env.step.return_value  = ([0.0] * 48, 0.0, True, False, {})
    mock_agent = MagicMock()
    mock_agent.epsilon = 0.5
    mock_agent.train_step.return_value = 0.0

    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("rl.dqn_agent.DQNAgent", return_value=mock_agent), \
         patch("app.api.routes.rl._make_env", return_value=mock_env):
        _state.training_active = True
        rl_module._run_training(episodes=1, model_path=str(model_file))

    mock_agent.load.assert_called_once_with(str(model_file))


def test_run_training_stops_when_flag_cleared(tmp_path):
    """Training stopt vroegtijdig als training_active=False gezet wordt."""
    mock_env = MagicMock()
    mock_env.reset.return_value = ([0.0] * 48, {})
    mock_env.step.return_value  = ([0.0] * 48, 0.0, True, False, {})
    mock_agent = MagicMock()
    mock_agent.epsilon = 0.5
    mock_agent.train_step.return_value = 0.0

    call_count = 0
    original_reset = mock_env.reset

    def stop_after_first(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        _state.training_active = False
        return original_reset(*args, **kwargs)

    mock_env.reset.side_effect = stop_after_first

    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("rl.dqn_agent.DQNAgent", return_value=mock_agent), \
         patch("app.api.routes.rl._make_env", return_value=mock_env):
        _state.training_active = True
        rl_module._run_training(episodes=10, model_path=None)

    assert _state.training_episode <= 1


def test_run_training_exception_sets_error(tmp_path):
    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("app.api.routes.rl._make_env", side_effect=Exception("SUMO down")):
        _state.training_active = True
        rl_module._run_training(episodes=1, model_path=None)

    assert _state.training_error == "SUMO down"
    assert not _state.training_active


def test_run_training_env_close_error(tmp_path):
    """Zelfs als env.close() faalt, wordt training_active op False gezet."""
    mock_env = MagicMock()
    mock_env.reset.return_value = ([0.0] * 48, {})
    mock_env.step.return_value  = ([0.0] * 48, 0.0, True, False, {})
    mock_env.close.side_effect  = Exception("close failed")
    mock_agent = MagicMock()
    mock_agent.epsilon = 0.5
    mock_agent.train_step.return_value = 0.0

    with patch.object(rl_module, "MODELS_DIR", tmp_path), \
         patch("rl.dqn_agent.DQNAgent", return_value=mock_agent), \
         patch("app.api.routes.rl._make_env", return_value=mock_env):
        _state.training_active = True
        rl_module._run_training(episodes=1, model_path=None)

    assert not _state.training_active


# ── Inference ─────────────────────────────────────────────────────────────────

def test_inference_status_all_fields():
    response = client.get("/rl/inference/status")
    assert response.status_code == 200
    for field in ["active", "model", "step", "action", "queue", "reward", "error"]:
        assert field in response.json()


def test_start_inference_already_active():
    _state.inference_active = True
    assert client.post("/rl/inference/start",
                       json={"model_path": "x.pt"}).status_code == 400


def test_start_inference_training_active():
    _state.training_active = True
    assert client.post("/rl/inference/start",
                       json={"model_path": "x.pt"}).status_code == 400


def test_start_inference_model_not_found(tmp_path):
    with patch.object(rl_module, "MODELS_DIR", tmp_path):
        response = client.post("/rl/inference/start",
                               json={"model_path": "ghost.pt"})
    assert response.status_code == 404


def test_start_inference_success(tmp_path):
    model = tmp_path / "model.pt"
    model.write_bytes(b"w")
    with patch("threading.Thread") as mock_thread:
        mock_thread.return_value.start = MagicMock()
        response = client.post("/rl/inference/start",
                               json={"model_path": str(model)})
    assert response.status_code == 200


def test_stop_inference_not_active():
    assert client.post("/rl/inference/stop").status_code == 400


def test_stop_inference_success():
    _state.inference_active = True
    response = client.post("/rl/inference/stop")
    assert response.status_code == 200
    assert _state.inference_active is False


# ── _run_inference (direct, zonder thread) ───────────────────────────────────

def test_run_inference_full_loop():

    mock_agent = MagicMock()
    mock_agent.select_action.return_value = 0

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"queues": [1.0] * 8}

    step_count = 0

    def fake_get(url, **kwargs):
        nonlocal step_count
        step_count += 1
        if step_count >= 2:
            _state.inference_active = False
        return mock_resp

    with patch("rl.dqn_agent.DQNAgent", return_value=mock_agent), \
         patch("requests.get", side_effect=fake_get), \
         patch("requests.post"), \
         patch("time.sleep"):
        _state.inference_active = True
        rl_module._run_inference(model_path="fake.pt", max_steps=10)

    assert not _state.inference_active
    mock_agent.select_action.assert_called()


def test_run_inference_sumo_unreachable():
    """Als SumoWeb3D niet bereikbaar is, gebruikt hij zeros."""

    mock_agent = MagicMock()
    mock_agent.select_action.return_value = 1

    call_count = 0

    def fail_get(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        _state.inference_active = False
        raise ConnectionError("unreachable")

    with patch("rl.dqn_agent.DQNAgent", return_value=mock_agent), \
         patch("requests.get", side_effect=fail_get), \
         patch("requests.post"), \
         patch("time.sleep"):
        _state.inference_active = True
        rl_module._run_inference(model_path="fake.pt", max_steps=5)

    assert not _state.inference_active


def test_run_inference_exception_sets_error():
    with patch("rl.dqn_agent.DQNAgent", side_effect=Exception("agent fail")):
        _state.inference_active = True
        rl_module._run_inference(model_path="fake.pt", max_steps=1)

    assert _state.inference_error == "agent fail"
    assert not _state.inference_active


# ── Simulation status ─────────────────────────────────────────────────────────

def test_simulation_status_running():
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"simulationStatus": "running"}

    with patch("requests.get", return_value=mock_resp):
        response = client.get("/rl/simulation/status")

    assert response.status_code == 200
    data = response.json()
    assert data["running"] is True
    assert data["simulationStatus"] == "running"


def test_simulation_status_not_running():
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"simulationStatus": "stopped"}

    with patch("requests.get", return_value=mock_resp):
        response = client.get("/rl/simulation/status")

    assert response.status_code == 200
    assert response.json()["running"] is False


def test_simulation_status_http_error():
    mock_resp = MagicMock()
    mock_resp.ok     = False
    mock_resp.status_code = 503
    mock_resp.text   = "Service Unavailable"

    with patch("requests.get", return_value=mock_resp):
        response = client.get("/rl/simulation/status")

    assert response.status_code == 200
    assert response.json()["running"] is False


def test_simulation_status_timeout():
    import requests as req_lib
    with patch("requests.get", side_effect=req_lib.exceptions.Timeout):
        response = client.get("/rl/simulation/status")
    assert response.status_code == 200
    assert response.json()["simulationStatus"] == "timeout"


def test_simulation_status_connection_error():
    import requests as req_lib
    with patch("requests.get", side_effect=req_lib.exceptions.ConnectionError("refused")):
        response = client.get("/rl/simulation/status")
    assert response.status_code == 200
    assert response.json()["simulationStatus"] == "unreachable"


def test_simulation_status_unexpected_error():
    with patch("requests.get", side_effect=Exception("boom")):
        response = client.get("/rl/simulation/status")
    assert response.status_code == 200
    assert response.json()["simulationStatus"] == "error"


# ── predict_action ────────────────────────────────────────────────────────────
# Correcte patch: DQNAgent wordt geïmporteerd via `from rl.core.agent import DQNAgent`
# → patchen op "rl.dqn_agent.DQNAgent"

def test_predict_action_success_no_existing_agent():
    with patch("rl.dqn_agent.DQNAgent") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.select_action.return_value = 2
        mock_cls.return_value = mock_instance

        response = client.post("/rl/inference/predict", json={"tls_id": "test", "obs": [0.1] * 25, "phase": 0, "intensity": 0.5})

    assert response.status_code == 200
    assert response.json()["action"] == 2
    assert "tls_id" in response.json()
    mock_instance.select_action.assert_called_once()


def test_predict_action_with_existing_agent():
    mock_agent = MagicMock()
    mock_agent.select_action.return_value = 3
    rl_module._shared_agent = mock_agent

    # Stuur 4 lanes aan data (4x4 = 16 waarden), waarbij alleen de eerste van elke set (de queue) gevuld is
    test_obs = [0.5, 0.0, 0.0, 0.0] * 4
    response = client.post("/rl/inference/predict", json={"tls_id": "test", "obs": test_obs, "phase": 0, "intensity": 0.5})

    assert response.status_code == 200
    assert response.json()["action"] == 3

    # State vector is now 48-dim
    called_obs = mock_agent.select_action.call_args[0][0]
    assert len(called_obs) == 48
    # Lane features are now passed raw (normalized by sender)
    assert called_obs[0]  == pytest.approx(0.5)
    assert called_obs[1]  == pytest.approx(0.0)  # count slot (empty)


def test_predict_action_truncation():
    """Observaties langer dan 8 worden afgekapt (max 8 lanes)."""
    mock_agent = MagicMock()
    mock_agent.select_action.return_value = 0
    rl_module._shared_agent = mock_agent

    response = client.post("/rl/inference/predict", json={"tls_id": "test", "obs": [1.0] * 30, "phase": 0, "intensity": 0.5})

    assert response.status_code == 200
    called_obs = mock_agent.select_action.call_args[0][0]
    assert len(called_obs) == 48  # 48-dim state vector


def test_predict_action_loads_best_model(tmp_path):
    """Geen model_path → laadt dqn_*_best.pt automatisch."""
    best = tmp_path / "dqn_20240101_best.pt"
    best.write_bytes(b"w")

    with patch("rl.dqn_agent.DQNAgent") as mock_cls, \
         patch.object(rl_module, "MODELS_DIR", tmp_path):
        mock_instance = MagicMock()
        mock_instance.select_action.return_value = 1
        mock_cls.return_value = mock_instance

        response = client.post("/rl/inference/predict", json={"tls_id": "test", "obs": [0.1] * 25, "phase": 0, "intensity": 0.5})

    assert response.status_code == 200
    mock_instance.load.assert_called_once()


def test_predict_action_with_explicit_model_path(tmp_path):
    model = tmp_path / "custom_model.pt"
    model.write_bytes(b"w")

    with patch("rl.dqn_agent.DQNAgent") as mock_cls:
        mock_instance = MagicMock()
        mock_instance.select_action.return_value = 1
        mock_cls.return_value = mock_instance

        response = client.post("/rl/inference/predict",
                               json={"tls_id": "test", "obs": [0.2] * 25, "phase": 0, "intensity": 0.5, "model_path": str(model)})

    assert response.status_code == 200
    assert response.json()["action"] == 1
    mock_instance.load.assert_called_with(str(model))


def test_predict_action_agent_init_error():
    with patch("rl.dqn_agent.DQNAgent", side_effect=Exception("Model loading failed")):
        response = client.post("/rl/inference/predict", json={"tls_id": "test", "obs": [0] * 25, "phase": 0, "intensity": 0.5})

    assert response.status_code == 500
    assert "Model loading failed" in response.json()["detail"]


def test_predict_action_select_action_error():
    mock_agent = MagicMock()
    mock_agent.select_action.side_effect = Exception("Select action failed")
    rl_module._shared_agent = mock_agent

    response = client.post("/rl/inference/predict", json={"tls_id": "test", "obs": [0] * 25, "phase": 0, "intensity": 0.5})

    assert response.status_code == 500
    assert "Select action failed" in response.json()["detail"]

