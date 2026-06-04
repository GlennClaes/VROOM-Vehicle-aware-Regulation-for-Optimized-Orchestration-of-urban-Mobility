"""
fixed_time_baseline.py — Vaste tijdsbeheerder als baseline voor vergelijking met DQN
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path

import numpy as np

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

    env = SumoIntersectionEnv(
        sumocfg  = str(SUMOCFG),
        use_gui  = False,
        port     = 8814,
    )

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
    avg_queue = total_queue / max(steps, 1)

    result = {
        "run":            run_id,
        "green_duration": green_duration,
        "avg_queue":      round(avg_queue, 2),
        "reward":         round(total_reward, 2),
        "steps":          steps,
    }
    print(f"wachtrij={avg_queue:.1f}  reward={total_reward:.2f}")
    return result


# ── Benchmark ─────────────────────────────────────────────────────────────────

def benchmark(args):
    if not SUMOCFG.exists():
        print(f"FOUT: Scenario niet gevonden: {SUMOCFG}")
        sys.exit(1)

    green_times = [args.green] if args.green else [15, 30, 45, 60]
    all_results = []

    for green in green_times:
        print(f"\n{'='*60}")
        print(f"Fixed-time baseline — groene tijd: {green}s")
        print(f"{'='*60}")

        run_results = []
        for run in range(1, args.runs + 1):
            result = run_fixed_time(green_duration=green, run_id=run)
            run_results.append(result)
            time.sleep(0.5)

        avg_queue  = float(np.mean([r["avg_queue"] for r in run_results]))
        avg_reward = float(np.mean([r["reward"]    for r in run_results]))

        summary = {
            "green_duration": green,
            "runs":           args.runs,
            "avg_queue":      round(avg_queue,  2),
            "avg_reward":     round(avg_reward, 2),
            "individual_runs": run_results,
        }
        all_results.append(summary)

        print(f"\n  Gemiddeld over {args.runs} runs:")
        print(f"    Wachtrij : {avg_queue:.1f} voertuigen")
        print(f"    Reward   : {avg_reward:.2f}")

    output_path = LOGS_DIR / "fixed_time_results.json"
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\n{'='*60}")
    print(f"✅ Resultaten opgeslagen: {output_path}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--runs",  type=int, default=5)
    p.add_argument("--green", type=int, default=None)
    args = p.parse_args()
    benchmark(args)
