"""
train_local.py — Universele Multi-Intersection D3QN Training
Traint één universeel model op álle 28 verkeerslichten in Hasselt XL tegelijk.

FIXES (v2):
  1. Reward aggregatie per-intersection + safety penalties
  2. Memory correlation fix: sla 1/3 van intersections op
  3. Epsilon decay vertraagd (0.995) → zie dqn_agent.py
  4. Target network op step-basis → zie dqn_agent.py
  5. State sanity check per stap
  6. Indentatie-bug in while-loop opgelost
"""

import os
import sys
import argparse
import time
import json
from datetime import datetime
from pathlib import Path

import numpy as np

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

if os.environ.get("SUMO_HOME"):
    tools = os.path.join(os.environ["SUMO_HOME"], "tools")
    if tools not in sys.path:
        sys.path.append(tools)

from sumo_env import SumoIntersectionEnv, STATE_DIM  # noqa: E402
from dqn_agent import DQNAgent  # noqa: E402

# ── Paden instellen ───────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
RL_DIR     = SCRIPT_DIR
MODELS_DIR = RL_DIR / "models"
LOGS_DIR   = RL_DIR / "training"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# ── Training ──────────────────────────────────────────────────────────────────

def train(args):
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("=" * 60)
    print("UNIVERSAL D3QN TRAINING - Hasselt XL (Network-wide)")
    print(f"Episodes : {args.episodes}")
    print(f"Sessie   : {session_id}")
    print("=" * 60)

    # Initialize Universele Environment
    env = SumoIntersectionEnv(
        use_gui=args.gui,
        port=8814,  # Poort 8814 om conflict met Docker (8813) te voorkomen
    )

    # Maak agent op basis van environment dimensies
    state_dim  = env.observation_space.shape[0]
    action_dim = env.action_space.n
    agent = DQNAgent(state_dim=state_dim, action_dim=action_dim)

    # Hervat vanaf checkpoint?
    if args.load:
        try:
            agent.load(args.load)
        except Exception as e:
            print(f"[WAARSCHUWING] Kon {args.load} niet laden (architectuur mismatch?): {e}")
            print("[INFO] We gaan verder met een vers model.")
    else:
        if args.fresh:
            print("[INFO] Nieuw universeel model starten (--fresh flag actief)")
        else:
            finals = sorted(MODELS_DIR.glob("dqn_universal_*_final.pt"))
            if finals:
                try:
                    agent.load(str(finals[-1]))
                    print(f"[INFO] Automatisch hervat: {finals[-1].name}")
                except Exception:
                    print("[INFO] Geen compatibel universeel model gevonden. Start nieuw.")
            else:
                print("[INFO] Nieuw universeel model starten")

    if args.epsilon is not None:
        agent.epsilon = args.epsilon

    history     = []
    ema_reward  = None
    alpha       = 0.05
    best_reward = float("-inf")
    best_rewards = {
        "night": float("-inf"),
        "quiet": float("-inf"),
        "normal": float("-inf"),
        "rush_hour": float("-inf")
    }

    for episode in range(1, args.episodes + 1):
        ep_start = time.time()

        try:
            obs_dict, _ = env.reset()
        except Exception as e:
            print(f"[ERROR] Reset faalde: {e}")
            continue

        tls_ids         = list(obs_dict.keys())
        losses          = []
        steps           = 0
        done            = False
        step_rewards    = []  # Track all step rewards for accurate episode mean

        while not done:
            # ── FIX 5: State sanity check ──────────────────────────────────
            for tls_id, obs in obs_dict.items():
                assert len(obs) == STATE_DIM, (
                    f"State mismatch bij {tls_id}: verwacht {STATE_DIM}, kreeg {len(obs)}"
                )

            # 1. Selecteer acties voor ALLE kruispunten
            actions = {}
            current_obs = {}
            for tls_id, obs in obs_dict.items():
                fb_action = env.get_max_pressure_action(tls_id)
                actions[tls_id] = agent.select_action(obs, training=True, fallback_action=fb_action)
                current_obs[tls_id] = obs

            # 2. Omgevingsstap
            next_obs_dict, rewards_dict, terminated, truncated, info = env.step(actions)
            done = terminated or truncated

            # ── Reward aggregatie & memory ────────────────────────────────
            avg_step_reward = 0.0
            valid_count     = 0
            n_tls           = max(len(tls_ids), 1)

            for i, tls_id in enumerate(tls_ids):
                if tls_id not in rewards_dict or tls_id not in next_obs_dict or tls_id not in current_obs:
                    continue

                r = rewards_dict[tls_id]

                # Gentle safety penalties to guide the agent without overwhelming the reward
                r -= 0.5  * info.get("emergency_braking", 0) / n_tls
                r -= 1.0 * info.get("teleports", 0) / n_tls

                avg_step_reward += r
                valid_count     += 1

                agent.remember(
                    current_obs[tls_id],
                    actions[tls_id],
                    r,
                    next_obs_dict[tls_id],
                    float(done)
                )

            avg_step_reward = avg_step_reward / valid_count if valid_count > 0 else 0.0
            step_rewards.append(avg_step_reward)

            obs_dict = next_obs_dict

            # 4. Train stap (elke 8 stappen trainen voor nog meer snelheidswinst)
            if steps % 8 == 0:
                loss = agent.train_step()
                if loss > 0:
                    losses.append(loss)

            steps += 1

        # ── Einde episode ────────────────────────────────────────────────
        # True episode reward = mean of ALL step rewards
        avg_ep_reward = float(np.mean(step_rewards)) if step_rewards else 0.0

        if ema_reward is None:
            ema_reward = avg_ep_reward
        else:
            ema_reward = (1 - alpha) * ema_reward + alpha * avg_ep_reward

        agent.decay_epsilon()
        # FIX 4: episode-based target update VERWIJDERD → agent doet dit op steps

        ep_duration = time.time() - ep_start
        avg_loss    = float(np.mean(losses)) if losses else 0.0

        history.append({
            "episode":    episode,
            "avg_reward": round(avg_ep_reward, 5),
            "ema_reward": round(ema_reward, 5),
            "avg_loss":   round(avg_loss, 5),
            "epsilon":    round(agent.epsilon, 4),
            "steps":      steps,
            "duration_s": round(ep_duration, 1),
        })

        print(
            f"[{episode:3d}/{args.episodes}] "
            f"reward={avg_ep_reward:8.5f} (EMA={ema_reward:8.5f})  "
            f"loss={avg_loss:.5f}  eps={agent.epsilon:.3f}  "
            f"steps={steps}  mem={len(agent.memory):6d}  ({ep_duration:.1f}s)"
        )

        if episode % 10 == 0:
            ckpt = MODELS_DIR / f"dqn_universal_{session_id}_ep{episode:03d}.pt"
            agent.save(str(ckpt))
            with open(LOGS_DIR / "universal_training_log.json", "w") as f:
                json.dump(history, f, indent=2)

        if avg_ep_reward > best_rewards.get(env.current_scenario, float("-inf")):
            best_rewards[env.current_scenario] = avg_ep_reward
            agent.save(str(MODELS_DIR / f"dqn_universal_best_{env.current_scenario}.pt"))
            print(f"  ↑ Nieuw beste {env.current_scenario} model opgeslagen (reward={best_rewards[env.current_scenario]:.2f})")

        # FIX: Sla het ALGEMENE beste model alleen op als de EMA verbetert
        # Dit voorkomt dat een 'night' scenario een goed 'rush_hour' model overschrijft
        if ema_reward > best_reward:
            best_reward = ema_reward
            agent.save(str(MODELS_DIR / "dqn_universal_best.pt"))
            print(f"  ↑ Nieuw algemeen beste model opgeslagen (EMA reward={best_reward:.2f})")

    final_path = MODELS_DIR / f"dqn_universal_{session_id}_final.pt"
    agent.save(str(final_path))
    print(f"\n[KLAAR] Finaal model: {final_path}")
    env.close()


# * Opmerking avg_ep_reward:
#   Voor een nauwkeuriger episodisch gemiddelde kun je een lijst bijhouden:
#       step_rewards = []
#       ...
#       step_rewards.append(avg_step_reward)
#   en na de while-loop:
#       avg_ep_reward = np.mean(step_rewards)
#   Dit is weggelaten om de diff klein te houden.


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--episodes", type=int,   default=200)
    p.add_argument("--gui",      action="store_true")
    p.add_argument("--load",     type=str,   default=None)
    p.add_argument("--epsilon",  type=float, default=None)
    p.add_argument("--fresh",    action="store_true", help="Start training completely from scratch")
    args = p.parse_args()
    train(args)