"""
baseline_heuristic.py — Vaste tijdsbeheerder als baseline voor vergelijking met DQN
"""

import os
import sys
from pathlib import Path


# ── Paden instellen ───────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
LOGS_DIR   = SCRIPT_DIR / "training"
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
from sumo_env import SumoIntersectionEnv, STEPS_PER_ACTION # noqa: E402


# ── Fixed-time controller ─────────────────────────────────────────────────────

def run_fixed_time(green_duration: int = 30, run_id: int = 1) -> dict:
    steps_per_phase = max(1, green_duration // STEPS_PER_ACTION)

    print(f"  [Run {run_id}] SUMO laden...", end=" ", flush=True)
    env = SumoIntersectionEnv(sumocfg=str(SUMOCFG), use_gui=False, port=8814)

    obs, _       = env.reset()
    total_reward = 0.0
    total_queue  = 0.0
    steps        = 0
    phase_idx    = 0
    phase_timer  = 0
    done         = False

    while not done:
        if phase_timer >= steps_per_phase:
            phase_idx  = (phase_idx + 1) % 4
            phase_timer = 0
        obs, reward, terminated, truncated, info = env.step(phase_idx)
        done          = terminated or truncated
        total_reward += reward
        total_queue  += info.get("total_queue", 0)
        steps        += 1
        phase_timer  += 1

    env.close()
    return {"reward": total_reward, "avg_queue": total_queue / max(steps, 1)}

if __name__ == "__main__":
    run_fixed_time()
