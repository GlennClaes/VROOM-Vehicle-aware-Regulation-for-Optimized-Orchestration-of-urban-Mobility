"""
app/routers/rl.py

Training:  MockEnv (geen directe SUMO/TraCI verbinding vanuit backend)
Inference: getraind model stuurt lichten via SumoWeb3D HTTP API
"""

import os
import sys
import json
import asyncio
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Bepaal de root directory (backend/)
# Dit werkt zowel lokaal als in Docker (/app/)
BASE_DIR = Path(__file__).resolve().parents[3]
if not (BASE_DIR / "rl").exists():
    # Fallback als we in een andere structuur zitten
    BASE_DIR = Path(__file__).resolve().parents[2]

RL_DIR     = BASE_DIR / "rl"
MODELS_DIR = RL_DIR / "models"
LOGS_DIR   = RL_DIR / "training"
SUMO_WEB3D_URL = os.environ.get("SUMO_WEB3D_URL", "http://sumo-web3d:5000")

sys.path.insert(0, str(RL_DIR))
MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/rl", tags=["Reinforcement Learning"])


# ── State ─────────────────────────────────────────────────────────────────────

class RLState:
    def __init__(self):
        self.training_active    = False
        self.training_episode   = 0
        self.training_total     = 0
        self.training_reward    = 0.0
        self.training_epsilon   = 1.0
        self.training_avg_queue = 0.0
        self.training_pressure  = 0.0
        self.training_fairness  = 1.0
        self.training_loss      = 0.0
        self.training_started   = None
        self.training_error     = None
        self.inference_active   = False
        self.inference_model    = None
        self.inference_step     = 0
        self.inference_action   = 0
        self.inference_queue    = 0.0
        self.inference_reward   = 0.0
        self.inference_error    = None

_state = RLState()

# Global shared agent for synchronous/fast prediction without reloading
_shared_agent = None


# ── Request modellen ──────────────────────────────────────────────────────────

class TrainingRequest(BaseModel):
    episodes:   int           = 150
    model_path: Optional[str] = None

class InferenceRequest(BaseModel):
    model_path: str
    max_steps:  int = 3600

class PredictRequest(BaseModel):
    tls_id: str
    obs: list[float]  # 25 lane queues
    phase: int       # current phase
    intensity: float # scenario intensity (0.2 - 1.0)
    model_path: Optional[str] = None

class BatchPredictRequest(BaseModel):
    """Batch prediction for ALL traffic lights in one call."""
    predictions: list[PredictRequest]
    model_path: Optional[str] = None



# ── Echte SUMO environment via sumo-traci container ──────────────────────────

def _make_env():
    from rl.core.env import SumoIntersectionEnv
    sumocfg = os.environ.get("SUMO_SCENARIO", "/app/scenarios/hasselt_xl/osm.sumocfg")
    return SumoIntersectionEnv(sumocfg=sumocfg)



# ── Training thread ───────────────────────────────────────────────────────────

def _run_training(episodes: int, model_path: Optional[str]):
    env = None
    try:
        from rl.dqn_agent import DQNAgent

        env   = _make_env()
        agent = DQNAgent(state_dim=48, action_dim=8)

        if model_path and Path(model_path).exists():
            agent.load(model_path)

        _state.training_total   = episodes
        _state.training_started = datetime.now().isoformat()

        # Unieke sessie-ID op basis van tijdstip — zodat modellen nooit overschreven worden
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        for episode in range(1, episodes + 1):
            if not _state.training_active:
                break

            obs, _       = env.reset()
            total_reward = 0.0
            total_queue  = 0.0
            losses       = []
            steps        = 0
            done         = False

            while not done and _state.training_active:
                action = agent.select_action(obs, training=True)
                next_obs, reward, terminated, truncated, info = env.step(action)
                done = terminated or truncated
                agent.remember(obs, action, reward, next_obs, float(done))
                obs = next_obs
                loss = agent.train_step()
                if loss > 0:
                    losses.append(loss)
                total_reward += reward
                total_queue  += info.get("total_queue", 0)
                steps        += 1

            agent.decay_epsilon()

            _state.training_episode   = episode
            _state.training_reward    = round(total_reward, 2)
            _state.training_epsilon   = round(agent.epsilon, 4)
            _state.training_avg_queue = round(total_queue / max(steps, 1), 1)
            _state.training_pressure  = round(info.get("pressure", 0), 2)
            _state.training_fairness  = round(info.get("fairness", 1.0), 3)
            _state.training_loss      = round(sum(losses) / len(losses) if losses else 0.0, 5)

            if episode % 25 == 0:
                agent.save(str(MODELS_DIR / f"dqn_{session_id}_ep{episode:04d}.pt"))

        agent.save(str(MODELS_DIR / f"dqn_{session_id}_final.pt"))

    except Exception as e:
        _state.training_error = str(e)
    finally:
        if env is not None:
            try:
                env.close()
            except Exception as close_err:
                print(f"[RL] Warning: error closing environment: {close_err}")
        _state.training_active = False


# ── Inference thread ──────────────────────────────────────────────────────────

def _run_inference(model_path: str, max_steps: int):
    import time
    import requests

    try:
        from rl.dqn_agent import DQNAgent

        agent         = DQNAgent(state_dim=48, action_dim=8)
        agent.load(model_path)
        agent.epsilon = 0.0

        _state.inference_model = model_path
        _state.inference_step  = 0

        for step in range(max_steps):
            if not _state.inference_active:
                break

            # Haal staat op van SumoWeb3D
            try:
                resp   = requests.get(f"{SUMO_WEB3D_URL}/api/state", timeout=2)
                state  = resp.json() if resp.ok else {}
                queues = state.get("queues", [0.0] * 8)
            except Exception:
                queues = [0.0] * 8

            if len(queues) < 8:
                queues = queues + [0.0] * (8 - len(queues))

            obs    = np.array(queues[:8], dtype=np.float32) / 50.0
            action = agent.select_action(obs, training=False)

            # Stuur fase naar SumoWeb3D
            try:
                # Map action back to phase name (NS/EW for simple 2-phase, or use index for multi-phase)
                # For Universal model we might want to send the index directly or map it.
                # Assuming the web3d handles phase index or specific names.
                requests.post(
                    f"{SUMO_WEB3D_URL}/api/traffic-lights",
                    json={"phase": action}, # Try sending the index directly
                    timeout=2,
                )
            except Exception:
                pass

            _state.inference_action = action
            _state.inference_queue  = round(float(np.sum(obs) * 50), 1)
            _state.inference_reward = round(-_state.inference_queue / 50.0, 3)
            _state.inference_step   = step + 1
            time.sleep(1)

    except Exception as e:
        _state.inference_error = str(e)
    finally:
        _state.inference_active = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/training/start")
def start_training(req: TrainingRequest):
    if _state.training_active:
        raise HTTPException(400, "Training is al actief.")
    if _state.inference_active:
        raise HTTPException(400, "Stop inference eerst.")
    _state.training_active  = True
    _state.training_episode = 0
    _state.training_error   = None

    # Automatisch meest recente model laden als geen model opgegeven
    model_path = req.model_path
    if not model_path:
        finals = sorted(MODELS_DIR.glob("dqn_*_final.pt"))
        if finals:
            model_path = str(finals[-1])  # meest recente op basis van naam (timestamp)
    threading.Thread(target=_run_training, args=(req.episodes, model_path), daemon=True).start()
    return {
        "status":       "training gestart",
        "episodes":     req.episodes,
        "resumed_from": model_path or "nieuw model",
    }


@router.get("/training/status")
def training_status():
    return {
        "active":       _state.training_active,
        "episode":      _state.training_episode,
        "total":        _state.training_total,
        "progress_pct": round(_state.training_episode / max(_state.training_total, 1) * 100, 1),
        "reward":       _state.training_reward,
        "epsilon":      _state.training_epsilon,
        "avg_queue":    _state.training_avg_queue,
        "pressure":     _state.training_pressure,
        "fairness":     _state.training_fairness,
        "loss":         _state.training_loss,
        "started":      _state.training_started,
        "error":        _state.training_error,
    }


@router.post("/training/stop")
def stop_training():
    if not _state.training_active:
        raise HTTPException(400, "Geen actieve training.")
    _state.training_active = False
    return {"status": "training wordt gestopt"}


@router.get("/training/log")
def training_log():
    log_path = LOGS_DIR / "training_log.json"
    if not log_path.exists():
        return []
    with open(log_path) as f:
        return json.load(f)


@router.get("/simulation/status")
def simulation_status():
    """Return the current SUMO simulation status from the SumoWeb3D component."""
    import requests
    try:
        print(f"[RL] Fetching simulation status from {SUMO_WEB3D_URL}/state")
        resp = requests.get(f"{SUMO_WEB3D_URL}/state", timeout=5)

        if not resp.ok:
            print(f"[RL] Status endpoint returned {resp.status_code}: {resp.text}")
            return {
                "simulationStatus": "unknown",
                "running": False,
                "error": f"HTTP {resp.status_code}",
            }

        payload = resp.json()
        print(f"[RL] Got state from sumo-web3d: {payload}")
        status = payload.get("simulationStatus", "unknown")

        return {
            "simulationStatus": status,
            "running": status in ["running", "paused", "loading"],
            "raw": payload,
        }
    except requests.exceptions.Timeout:
        print(f"[RL] Timeout connecting to {SUMO_WEB3D_URL}/state")
        return {"simulationStatus": "timeout", "running": False, "error": "SUMO-web3d timeout"}
    except requests.exceptions.ConnectionError as e:
        print(f"[RL] Connection error to {SUMO_WEB3D_URL}/state: {e}")
        return {"simulationStatus": "unreachable", "running": False, "error": str(e)}
    except Exception as e:
        print(f"[RL] Unexpected error in simulation_status: {e}")
        return {"simulationStatus": "error", "running": False, "error": str(e)}


@router.post("/inference/start")
def start_inference(req: InferenceRequest):
    if _state.inference_active:
        raise HTTPException(400, "Inference is al actief.")
    if _state.training_active:
        raise HTTPException(400, "Stop training eerst.")
    model_path = req.model_path
    if not Path(model_path).exists():
        model_path = str(MODELS_DIR / req.model_path)
    if not Path(model_path).exists():
        raise HTTPException(404, f"Model niet gevonden: {req.model_path}")
    _state.inference_active = True
    _state.inference_error  = None
    threading.Thread(target=_run_inference, args=(model_path, req.max_steps), daemon=True).start()
    return {"status": "inference gestart", "model": model_path, "sumo_web3d": "http://localhost:5000"}

def preload_agent(model_path: str = None):
    """
    Initialize the RL agent and load the model. 
    Supports dynamic switching: if a different model_path is requested, it reloads the weights.
    """
    global _shared_agent
    
    try:
        # 1. Initialize agent if needed
        if _shared_agent is None:
            from rl.dqn_agent import DQNAgent 
            _shared_agent = DQNAgent(state_dim=48, action_dim=8, device="cpu")

        # 2. Resolve model path
        target_model = model_path
        if not target_model:
            # Fallback to best/latest if none specified
            finals = sorted(MODELS_DIR.glob("dqn_universal_*_best.pt"))
            if not finals:
                finals = sorted(MODELS_DIR.glob("dqn_universal_*.pt"))
            if not finals:
                finals = sorted(MODELS_DIR.glob("dqn_*.pt"))
            
            if finals:
                target_model = str(finals[-1])

        if target_model and not Path(target_model).is_absolute():
            candidate = MODELS_DIR / target_model
            if candidate.exists():
                target_model = str(candidate)

        # 3. Dynamic Switching: Only load if different from current
        if target_model and Path(target_model).exists():
            if _state.inference_model != target_model:
                print(f"[RL Predict] Switching/Loading model: {target_model}", flush=True)
                _shared_agent.load(target_model)
                _shared_agent.epsilon = 0.0 
                _state.inference_model = target_model
        elif not _state.inference_model:
            print("[RL Predict] Warning: No model available. Using random weights.", flush=True)
            _state.inference_model = "random_weights"

        return _shared_agent
    except Exception as e:
        print(f"[RL Predict] Failed to prepare agent: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise e

@router.post("/inference/predict")
def predict_action(req: PredictRequest):
    global _shared_agent

    try:
        preload_agent(req.model_path)
    except Exception as e:
        raise HTTPException(500, f"Error preparing RL agent: {e}")

    # ── BUILD EXACT 48-DIM STATE (MATCH sumo_env.py) ──
    obs_48 = np.zeros(48, dtype=np.float32)

    # 1. Lane features (Max 8 lanes, 4 features each = 32)
    # req.obs should now contain flattened lane features [q, c, w, s, q, c, w, s...]
    for i in range(min(len(req.obs), 32)):
        obs_48[i] = req.obs[i]

    # 2. Global features (32..43: Phase One-Hot, 44: Intensity, 45: MinGreen, 46: Yellow, 47: Neighbor)
    # Phase One-Hot (Max 12 phases)
    phase_idx = int(req.phase)
    if 0 <= phase_idx < 12:
        obs_48[32 + phase_idx] = 1.0
    
    obs_48[44] = req.intensity
    obs_48[45] = 1.0 # Default min_green passed for inference
    obs_48[46] = 0.0 # Yellow active
    obs_48[47] = 0.0 # Neighbor pressure (not available in simple req)

    try:
        action = _shared_agent.select_action(obs_48, training=False)

        print(f"[RL Predict] action={action} tls_id={req.tls_id}", flush=True)

        return {
            "action": action,
            "model": _state.inference_model,
            "tls_id": req.tls_id
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error during prediction: {e}")


def _build_obs_48(obs_list, phase, intensity):
    """Build the 48-dim state vector from list of features."""
    obs_48 = np.zeros(48, dtype=np.float32)
    # Lanes
    for i in range(min(len(obs_list), 32)):
        obs_48[i] = obs_list[i]
    # One-hot phase
    p_idx = int(phase)
    if 0 <= p_idx < 12:
        obs_48[32 + p_idx] = 1.0
    obs_48[44] = intensity
    obs_48[45] = 1.0
    obs_48[46] = 0.0
    obs_48[47] = 0.0
    return obs_48


@router.post("/inference/predict_batch")
def predict_batch(req: BatchPredictRequest):
    """
    Batch prediction for ALL traffic lights in a single call.
    Dramatically reduces latency vs 28 individual calls.
    """
    global _shared_agent

    model_path = req.model_path
    try:
        preload_agent(model_path)
    except Exception as e:
        raise HTTPException(500, f"Error preparing RL agent: {e}")

    results = {}
    for pred in req.predictions:
        obs_48 = _build_obs_48(pred.obs, pred.phase, pred.intensity)
        try:
            action = _shared_agent.select_action(obs_48, training=False)
            results[pred.tls_id] = action
        except Exception:
            results[pred.tls_id] = -1  # Fallback

    return {"actions": results, "model": _state.inference_model}


@router.get("/inference/status")
def inference_status():
    return {
        "active":  _state.inference_active,
        "model":   _state.inference_model,
        "step":    _state.inference_step,
        "action":  _state.inference_action,
        "queue":   _state.inference_queue,
        "reward":  _state.inference_reward,
        "error":   _state.inference_error,
    }


@router.post("/inference/stop")
def stop_inference():
    if not _state.inference_active:
        raise HTTPException(400, "Geen actieve inference.")
    _state.inference_active = False
    return {"status": "inference gestopt"}


@router.get("/models")
def list_models():
    if not MODELS_DIR.exists():
        return []
    
    files = sorted(MODELS_DIR.glob("*.pt"))
    
    return [
        {"name": f.name, "path": str(f), "size_kb": round(f.stat().st_size / 1024, 1),
         "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat()}
        for f in files
    ]


@router.delete("/models/{model_name}")
def delete_model(model_name: str):
    path = MODELS_DIR / model_name
    if not path.exists():
        raise HTTPException(404, f"Model niet gevonden: {model_name}")
    path.unlink()
    return {"status": f"{model_name} verwijderd"}


@router.get("/training/stream")
async def training_stream():
    async def generator():
        while True:
            yield f"data: {json.dumps({'active': _state.training_active, 'episode': _state.training_episode, 'total': _state.training_total, 'reward': _state.training_reward, 'epsilon': _state.training_epsilon, 'avg_queue': _state.training_avg_queue, 'pressure': _state.training_pressure, 'fairness': _state.training_fairness, 'loss': _state.training_loss, 'error': _state.training_error})}\n\n"
            await asyncio.sleep(1)
    return StreamingResponse(generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*"})
