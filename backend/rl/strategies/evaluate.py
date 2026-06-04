"""
evaluate.py — Evalueer het getrainde DQN model in de echte SUMO simulatie
"""

import os
import sys
import argparse
from pathlib import Path

import numpy as np

# ── Paden instellen ───────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
RL_DIR     = SCRIPT_DIR
MODELS_DIR = RL_DIR / "models"
LOGS_DIR   = RL_DIR / "training"
SUMOCFG    = SCRIPT_DIR.parent / "scenarios" / "hasselt_xl" / "osm.sumocfg"

LOGS_DIR.mkdir(parents=True, exist_ok=True)

# ── SUMO_HOME instellen ───────────────────────────────────────────────────────
if not os.environ.get("SUMO_HOME"):
    candidates = [
        r"C:\Program Files (x86)\Eclipse\Sumo",
        r"C:\Program Files\Eclipse\Sumo",
        r"C:\sumo",
        "/usr/share/sumo",
        "/opt/homebrew/opt/sumo",
    ]
    for path in candidates:
        if os.path.exists(path):
            os.environ["SUMO_HOME"] = path
            break

if not os.environ.get("SUMO_HOME"):
    print("FOUT: SUMO_HOME niet gevonden.")
    sys.exit(1)

tools = os.path.join(os.environ["SUMO_HOME"], "tools")
if tools not in sys.path:
    sys.path.append(tools)

sys.path.insert(0, str(SCRIPT_DIR))
from sumo_env  import SumoIntersectionEnv # noqa: E402
from dqn_agent import DQNAgent # noqa: E402


# ── Één evaluatie episode ─────────────────────────────────────────────────────

def run_episode(env: SumoIntersectionEnv, agent: DQNAgent) -> dict:
    """Voert één episode uit en geeft gedetailleerde metrics terug."""
    obs, _       = env.reset()
    total_reward = 0.0
    total_queue  = 0.0
    steps        = 0
    done         = False
    action_counts = [0, 0, 0, 0]

    while not done:
        action = agent.select_action(obs, training=False)
        action_counts[action] += 1
        obs, reward, terminated, truncated, info = env.step(action)
        done          = terminated or truncated
        total_reward += reward
        total_queue  += info.get("total_queue", 0)
        steps        += 1

    return {
        "reward":       round(total_reward, 2),
        "avg_queue":    round(total_queue / max(steps, 1), 2),
        "steps":        steps,
        "action_dist":  action_counts,
    }


# ── DQN evaluatie ─────────────────────────────────────────────────────────────

def evaluate_dqn(model_path: str, n_episodes: int = 5) -> dict:
    """Evalueert het DQN model over meerdere episodes."""

    print(f"\n{'='*60}")
    print(f"DQN Evaluatie: {Path(model_path).name}")
    print(f"Episodes: {n_episodes}")
    print(f"{'='*60}")

    env   = SumoIntersectionEnv(sumocfg=str(SUMOCFG), use_gui=False, port=8813)
    agent = DQNAgent(state_dim=48, action_dim=8)
    agent.load(model_path)
    agent.epsilon = 0.0

    results = []
    for ep in range(1, n_episodes + 1):
        print(f"  Episode {ep}/{n_episodes}...", end=" ", flush=True)
        result = run_episode(env, agent)
        results.append(result)
        print(f"reward={result['reward']:.2f}  wachtrij={result['avg_queue']:.1f}")

    env.close()

    summary = {
        "model":        Path(model_path).name,
        "episodes":     n_episodes,
        "avg_reward":   round(float(np.mean([r["reward"]    for r in results])), 2),
        "std_reward":   round(float(np.std( [r["reward"]    for r in results])), 2),
        "avg_queue":    round(float(np.mean([r["avg_queue"] for r in results])), 2),
        "std_queue":    round(float(np.std( [r["avg_queue"] for r in results])), 2),
        "individual":   results,
    }

    return summary


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--model",    type=str,  default=None)
    p.add_argument("--episodes", type=int,  default=5)
    args = p.parse_args()

    finals = sorted(MODELS_DIR.glob("dqn_*_final.pt"))
    model_path = args.model or (str(finals[-1]) if finals else None)

    if not model_path:
        print("FOUT: Geen model gevonden.")
        sys.exit(1)

    evaluate_dqn(model_path, n_episodes=args.episodes)
