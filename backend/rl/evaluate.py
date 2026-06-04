"""
evaluate.py — Evalueer het getrainde DQN model in de echte SUMO simulatie
"""

import os
import sys
import json
import argparse
from pathlib import Path

import numpy as np

# ── Paden instellen ───────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
MODELS_DIR = SCRIPT_DIR / "models"
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
from sumo_env  import SumoIntersectionEnv # noqa: E402
from dqn_agent import DQNAgent # noqa: E402


# ── Één evaluatie episode ─────────────────────────────────────────────────────

def run_episode(env: SumoIntersectionEnv, agent: DQNAgent) -> dict:
    """Voert één episode uit over ALLE kruispunten."""
    obs_dict, _  = env.reset()
    total_reward = 0.0
    total_queue  = 0.0
    steps        = 0
    done         = False
    
    # We tracken de actie-distributie nu globaal over alle TLS
    action_counts = [0] * 12

    while not done:
        # 1. Selecteer acties voor ALLE kruispunten
        actions = {
            tls_id: agent.select_action(obs, training=False) 
            for tls_id, obs in obs_dict.items()
        }
        
        # Track distributie (van de eerste paar kruispunten voor de vorm)
        for act in actions.values():
            action_counts[act] += 1

        # 2. Omgevingsstap
        next_obs_dict, rewards_dict, terminated, truncated, info = env.step(actions)
        done = terminated or truncated
        
        # 3. Reward aggregatie (gemiddelde van alle actieve kruispunten)
        step_rewards = list(rewards_dict.values())
        if step_rewards:
            total_reward += float(np.mean(step_rewards))
            
        total_queue  += info.get("total_queue", 0)
        steps        += 1
        obs_dict = next_obs_dict

    return {
        "reward":       round(total_reward / max(steps, 1), 2),
        "avg_queue":    round(total_queue / max(steps, 1), 2),
        "steps":        steps,
        "action_dist":  action_counts,
        "teleports":    info.get("teleports", 0)
    }


# ── DQN evaluatie ─────────────────────────────────────────────────────────────

def evaluate_dqn(model_path: str, n_episodes: int = 5) -> dict:
    """Evalueert het DQN model over meerdere episodes."""

    print(f"\n{'='*60}")
    print(f"DQN Evaluatie: {Path(model_path).name}")
    print(f"Episodes: {n_episodes}")
    print(f"{'='*60}")

    env   = SumoIntersectionEnv(sumocfg=str(SUMOCFG), use_gui=False, port=8815)
    # Gebruik de dimensies uit de environment
    state_dim  = env.observation_space.shape[0]
    action_dim = env.action_space.n
    agent = DQNAgent(state_dim=state_dim, action_dim=action_dim)
    agent.load(model_path)
    agent.epsilon = 0.0

    results = []
    for ep in range(1, n_episodes + 1):
        print(f"  Episode {ep}/{n_episodes}...", end=" ", flush=True)
        result = run_episode(env, agent)
        results.append(result)
        print(f"reward={result['reward']:.2f}  teleports={result.get('teleports', 0)}")

    env.close()

    summary = {
        "model":        Path(model_path).name,
        "episodes":     n_episodes,
        "avg_reward":   round(float(np.mean([r["reward"]    for r in results])), 2),
        "std_reward":   round(float(np.std( [r["reward"]    for r in results])), 2),
        "avg_queue":    round(float(np.mean([r["avg_queue"] for r in results])), 2),
        "std_queue":    round(float(np.std( [r["avg_queue"] for r in results])), 2),
        "best_reward":  round(float(max(    [r["reward"]    for r in results])), 2),
        "worst_reward": round(float(min(    [r["reward"]    for r in results])), 2),
        "individual":   results,
    }

    print("\n  Samenvatting DQN:")
    print(f"    Gem. reward  : {summary['avg_reward']:.2f} ± {summary['std_reward']:.2f}")
    print(f"    Gem. wachtrij: {summary['avg_queue']:.1f} ± {summary['std_queue']:.1f}")

    return summary


# ── Automatisch beste model vinden ────────────────────────────────────────────

def find_best_model() -> str:
    """Zoekt automatisch het meest recente finale model."""
    finals = sorted(MODELS_DIR.glob("dqn_*_final.pt"))
    if finals:
        return str(finals[-1])
    bests = sorted(MODELS_DIR.glob("dqn_*_best.pt"))
    if bests:
        return str(bests[-1])
    return None


# ── Vergelijking DQN vs fixed-time ────────────────────────────────────────────

def compare_with_baseline(dqn_summary: dict):
    """Vergelijkt DQN resultaten met opgeslagen fixed-time resultaten."""
    baseline_log = LOGS_DIR / "fixed_time_results.json"
    if not baseline_log.exists():
        print("\n⚠️  Geen fixed-time resultaten gevonden.")
        return

    with open(baseline_log) as f:
        baseline_results = json.load(f)

    best_baseline = min(baseline_results, key=lambda x: x["avg_queue"])

    print(f"\n{'='*60}")
    print("📊 VERGELIJKING: DQN vs Fixed-time")
    print(f"{'='*60}")
    print(f"  {'DQN agent':<25} {dqn_summary['avg_queue']:>15.1f} {dqn_summary['avg_reward']:>13.2f}")

    for b in baseline_results:
        label = f"Fixed-time ({b['green_duration']}s groen)"
        print(f"  {label:<25} {b['avg_queue']:>15.1f} {b['avg_reward']:>13.2f}")

    dqn_queue = dqn_summary["avg_queue"]
    best_fixed_queue = best_baseline["avg_queue"]
    if dqn_queue < best_fixed_queue:
        verbetering = (1 - dqn_queue / best_fixed_queue) * 100
        print(f"  ✅ DQN reduceert wachtrij met {verbetering:.1f}%!")
    else:
        print("  ⚠️  Fixed-time presteert nog beter.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--model",    type=str,  default=None)
    p.add_argument("--episodes", type=int,  default=5)
    p.add_argument("--compare",  action="store_true")
    args = p.parse_args()

    model_path = args.model or find_best_model()
    if not model_path:
        print("FOUT: Geen model gevonden.")
        sys.exit(1)

    summary = evaluate_dqn(model_path, n_episodes=args.episodes)
    if args.compare:
        compare_with_baseline(summary)
