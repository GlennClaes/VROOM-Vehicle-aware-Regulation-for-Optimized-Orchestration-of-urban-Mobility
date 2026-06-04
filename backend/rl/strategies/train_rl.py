"""
train_local.py — DQN training lokaal op je PC met echt Hasselt scenario
"""

import os
import sys
import argparse
import time
from pathlib import Path
from datetime import datetime
from collections import deque

import numpy as np

# ── Paden instellen ───────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
RL_DIR     = SCRIPT_DIR
MODELS_DIR = RL_DIR / "models"
LOGS_DIR   = RL_DIR / "training"
SUMOCFG    = SCRIPT_DIR.parent / "scenarios" / "hasselt_xl" / "osm.sumocfg"

sys.path.insert(0, str(RL_DIR))
MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# ── SUMO_HOME instellen voor TraCI ────────────────────────────────────────────
if not os.environ.get("SUMO_HOME"):
    candidates = [
        r"C:\Program Files (x86)\Eclipse\Sumo",
        r"C:\Program Files\Eclipse\Sumo",
        r"C:\sumo",
        "/usr/share/sumo",
        "/opt/homebrew/opt/sumo"
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

from sumo_env  import SumoIntersectionEnv # noqa: E402
from dqn_agent import DQNAgent, TARGET_UPDATE # noqa: E402


# ── Training ──────────────────────────────────────────────────────────────────

def train(args):
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("=" * 60)
    print("DQN Training — Hasselt XL scenario")
    print(f"Scenario : {SUMOCFG}")
    print(f"Episodes : {args.episodes}")
    print(f"Sessie   : {session_id}")
    print("=" * 60)

    if not SUMOCFG.exists():
        print(f"FOUT: Scenario niet gevonden: {SUMOCFG}")
        sys.exit(1)

    env   = SumoIntersectionEnv(
        sumocfg  = str(SUMOCFG),
        use_gui  = args.gui,
        port     = 8813,
    )
    agent = DQNAgent(state_dim=env.observation_space.shape[0], action_dim=env.action_space.n)

    if args.load:
        agent.load(args.load)
        print(f"[INFO] Model geladen: {args.load}")
    else:
        finals = sorted(MODELS_DIR.glob("dqn_*_final.pt"))
        if finals:
            agent.load(str(finals[-1]))
            print(f"[INFO] Automatisch hervat: {finals[-1].name}")
        else:
            print("[INFO] Nieuw model starten")

    history     = []
    all_rewards = deque(maxlen=50)

    for episode in range(1, args.episodes + 1):
        ep_start     = time.time()
        obs, _       = env.reset()
        total_reward = 0.0
        total_queue  = 0.0
        losses       = []
        steps        = 0
        done         = False

        while not done:
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
        if episode % TARGET_UPDATE == 0:
            agent.update_target_network()

        ep_duration = time.time() - ep_start
        avg_queue   = total_queue / max(steps, 1)
        avg_loss    = float(np.mean(losses)) if losses else 0.0
        all_rewards.append(total_reward)

        history.append({
            "episode":    episode,
            "reward":     round(total_reward, 3),
            "avg_queue":  round(avg_queue, 2),
            "epsilon":    round(agent.epsilon, 4),
            "loss":       round(avg_loss, 5),
            "duration_s": round(ep_duration, 1),
        })

        if episode % 5 == 0 or episode == 1:
            avg_r = np.mean(all_rewards)
            print(f"[{episode:4d}/{args.episodes}] reward={total_reward:8.2f}  gem={avg_r:8.2f}")

    env.close()

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--episodes", type=int,  default=150)
    p.add_argument("--gui",      action="store_true")
    p.add_argument("--load",     type=str,  default=None)
    args = p.parse_args()
    train(args)
