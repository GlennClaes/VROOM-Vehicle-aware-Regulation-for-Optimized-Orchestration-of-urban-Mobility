"""
trainer.py — Universele D3QN Pre-training op MockEnv
Gebruik dit om in < 2 minuten een basis-brain te trainen voor Hasselt XL.
"""

import os
import sys
import argparse
import time
import random
import numpy as np
import gymnasium as gym
from gymnasium import spaces

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dqn_agent import DQNAgent, TARGET_UPDATE # noqa: E402


# ── Universele Mock Environment ──────────────────────────────────────────────

class UniversalMockEnv(gym.Env):
    """
    Supersnelle simulatie die willekeurige kruispunten nabootst.
    Leert de agent de basisregels van verkeer zonder SUMO.
    """

    def __init__(self):
        super().__init__()
        # 27 features: 25 lanes + 1 phase + 1 intensity
        self.observation_space = spaces.Box(low=0.0, high=1.0, shape=(27,), dtype=np.float32)
        self.action_space = spaces.Discrete(8)
        
        self._queues = np.zeros(25, dtype=np.float32)
        self._phase  = 0
        self._intensity = 0.5
        self._step   = 0
        self._active_lanes = []

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        # Randomiseer kruispunt configuratie (aantal actieve lanes)
        num_lanes = random.randint(8, 25)
        self._active_lanes = random.sample(range(25), num_lanes)
        
        # Randomiseer intensiteit
        self._intensity = random.uniform(0.2, 1.0)
        
        # Willekeurige start wachtrijen
        self._queues = np.zeros(25, dtype=np.float32)
        for i in self._active_lanes:
            self._queues[i] = random.uniform(0.1, 0.5)
            
        self._phase = 0
        self._step = 0
        return self._get_obs(), {}

    def _get_obs(self):
        return np.concatenate([self._queues, [self._phase / 10.0, self._intensity]]).astype(np.float32)

    def step(self, action: int):
        self._step += 1
        self._phase = action
        
        # 1. Instroom (gebaseerd op intensiteit)
        for i in self._active_lanes:
            arrival = random.uniform(0.01, 0.05) * self._intensity
            self._queues[i] = np.clip(self._queues[i] + arrival, 0.0, 1.0)
            
        # 2. Uitstroom (gebaseerd op actie)
        # Simuleer dat de gekozen fase ~3-4 lanes groen geeft
        # We mappen actie (0-7) naar een subset van lanes
        green_start = (action * 3) % 25
        green_lanes = [(green_start + j) % 25 for j in range(4)]
        
        arrived = 0
        for i in green_lanes:
            if i in self._active_lanes:
                discharge = random.uniform(0.1, 0.2)
                if self._queues[i] > 0:
                    arrived += 1
                self._queues[i] = max(0.0, self._queues[i] - discharge)
        
        obs = self._get_obs()
        
        # 3. Reward (Flow focus)
        q_total = np.sum(self._queues)
        reward = (arrived * 2.0) - (q_total * 0.1)
        
        done = self._step >= 100 # Korte episodes voor snelle leerervaring
        return obs, float(reward), done, False, {"total_queue": q_total * 50}

# ── Training ──────────────────────────────────────────────────────────────────

def train(args):
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)

    print("=" * 60)
    print("UNIVERSAL PRE-TRAINING (Fast MockEnv)")
    print(f"Episodes : {args.episodes}")
    print("=" * 60)

    env = UniversalMockEnv()
    agent = DQNAgent(state_dim=27, action_dim=8)

    best_reward = float("-inf")
    start_time = time.time()

    for episode in range(1, args.episodes + 1):
        obs, _ = env.reset()
        total_reward = 0.0
        done = False
        while not done:
            action = agent.select_action(obs, training=True)
            next_obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            agent.remember(obs, action, reward, next_obs, float(done))
            obs = next_obs
            agent.train_step()
            total_reward += reward

        agent.decay_epsilon()
        if episode % TARGET_UPDATE == 0:
            agent.update_target_network()

        if episode % 100 == 0 or episode == 1:
            print(f"[{episode:4d}/{args.episodes}] Reward: {total_reward:7.2f}  Eps: {agent.epsilon:.3f}")

        if total_reward > best_reward:
            best_reward = total_reward
            agent.save(os.path.join(models_dir, "dqn_universal_mock.pt"))

    print(f"\n✅ Pre-training klaar in {time.time() - start_time:.1f}s!")
    print("▶ Nu fine-tunen:  python train_local.py --load models/dqn_universal_mock.pt")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--episodes", type=int, default=1000)
    args = p.parse_args()
    train(args)
