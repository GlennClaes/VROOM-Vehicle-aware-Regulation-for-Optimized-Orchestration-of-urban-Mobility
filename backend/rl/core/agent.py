"""
dqn_agent.py — Deep Q-Network (DQN) voor SUMO verkeerslichtbesturing

Implementeert:
  - DQN met Experience Replay
  - Target Network (stabielere training)
  - Epsilon-Greedy exploratie
  - Model opslaan/laden

Gebaseerd op: Mnih et al. (2015) "Human-level control through deep reinforcement learning"
"""

import os
import random
import numpy as np
from collections import deque

import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F


# ─── Hyperparameters ───────────────────────────────────────────────────────────

HIDDEN_SIZE     = 128       # neuronen per verborgen laag
LEARNING_RATE   = 1e-3      # Adam learning rate
GAMMA           = 0.99      # discount factor (belang van toekomstige rewards)
EPSILON_START   = 1.0       # startwaarde exploratie
EPSILON_END     = 0.05      # minimale exploratie
EPSILON_DECAY   = 0.995     # afname per episode
MEMORY_SIZE     = 10_000    # grootte van replay buffer
BATCH_SIZE      = 64        # aantal samples per train-stap
TARGET_UPDATE   = 10        # episodes tussen target-network updates


# ─── Neuraal Netwerk ───────────────────────────────────────────────────────────

class DQNNetwork(nn.Module):
    """
    Feed-forward netwerk dat Q(s, a) schat voor alle acties tegelijk.

    Input:  state_dim  (= aantal rijstroken = 8)
    Output: action_dim (= aantal fases = 2)
    """

    def __init__(self, state_dim: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, HIDDEN_SIZE),
            nn.ReLU(),
            nn.Linear(HIDDEN_SIZE, HIDDEN_SIZE),
            nn.ReLU(),
            nn.Linear(HIDDEN_SIZE, HIDDEN_SIZE // 2),
            nn.ReLU(),
            nn.Linear(HIDDEN_SIZE // 2, action_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ─── Replay Buffer ─────────────────────────────────────────────────────────────

class ReplayBuffer:
    """
    Circular buffer die (state, action, reward, next_state, done) tuples opslaat.
    Willekeurige sampling doorbreekt correlatie tussen opeenvolgende ervaringen.
    """

    def __init__(self, capacity: int):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (
            np.array(states,      dtype=np.float32),
            np.array(actions,     dtype=np.int64),
            np.array(rewards,     dtype=np.float32),
            np.array(next_states, dtype=np.float32),
            np.array(dones,       dtype=np.float32),
        )

    def __len__(self):
        return len(self.buffer)


# ─── DQN Agent ─────────────────────────────────────────────────────────────────

class DQNAgent:
    """
    DQN Agent met:
      - online netwerk  (wordt elke stap geüpdated)
      - target netwerk  (wordt elke TARGET_UPDATE episodes gekopieerd)
      - epsilon-greedy  (exploratie daalt naarmate training vordert)
    """

    def __init__(self, state_dim: int, action_dim: int,
                 device: str = "auto"):

        self.state_dim  = state_dim
        self.action_dim = action_dim
        self.device     = torch.device(
            "cuda" if (device == "auto" and torch.cuda.is_available()) else "cpu"
        )

        # Netwerken
        self.online_net = DQNNetwork(state_dim, action_dim).to(self.device)
        self.target_net = DQNNetwork(state_dim, action_dim).to(self.device)
        self.target_net.load_state_dict(self.online_net.state_dict())
        self.target_net.eval()

        # Optimizer & verlies
        self.optimizer = optim.Adam(self.online_net.parameters(), lr=LEARNING_RATE)

        # Replay buffer
        self.memory = ReplayBuffer(MEMORY_SIZE)

        # Exploratie
        self.epsilon = EPSILON_START

        # Statistieken
        self.train_steps = 0

        print(f"DQN Agent aangemaakt op {self.device}")
        print(f"  State dim:  {state_dim}")
        print(f"  Action dim: {action_dim}")
        total_params = sum(p.numel() for p in self.online_net.parameters())
        print(f"  Parameters: {total_params:,}")

    # ── Actie selectie ──────────────────────────────────────────────────────────

    def select_action(self, state: np.ndarray, training: bool = True) -> int:
        """
        Epsilon-greedy actieselectie:
          - met kans epsilon: random actie (exploratie)
          - anders:           greedy actie via Q-netwerk (exploitatie)
        """
        if training and random.random() < self.epsilon:
            return random.randint(0, self.action_dim - 1)

        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q_values = self.online_net(state_t)
        return int(q_values.argmax(dim=1).item())

    # ── Experience opslaan ──────────────────────────────────────────────────────

    def remember(self, state, action, reward, next_state, done):
        self.memory.push(state, action, reward, next_state, done)

    # ── Training stap ───────────────────────────────────────────────────────────

    def train_step(self) -> float:
        """
        Sample een mini-batch en update het online netwerk via de Bellman-vergelijking:
            Q(s, a) ← r + γ · max_a' Q_target(s', a')   (als niet done)
            Q(s, a) ← r                                   (als done)
        """
        if len(self.memory) < BATCH_SIZE:
            return 0.0

        states, actions, rewards, next_states, dones = self.memory.sample(BATCH_SIZE)

        states_t      = torch.FloatTensor(states).to(self.device)
        actions_t     = torch.LongTensor(actions).unsqueeze(1).to(self.device)
        rewards_t     = torch.FloatTensor(rewards).unsqueeze(1).to(self.device)
        next_states_t = torch.FloatTensor(next_states).to(self.device)
        dones_t       = torch.FloatTensor(dones).unsqueeze(1).to(self.device)

        # Huidige Q-waarden
        current_q = self.online_net(states_t).gather(1, actions_t)

        # Target Q-waarden (geen gradient door target net)
        with torch.no_grad():
            next_q      = self.target_net(next_states_t).max(dim=1, keepdim=True)[0]
            target_q    = rewards_t + GAMMA * next_q * (1 - dones_t)

        # Verlies en backprop
        loss = F.smooth_l1_loss(current_q, target_q)   # Huber loss
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.online_net.parameters(), 10.0)
        self.optimizer.step()

        self.train_steps += 1
        return float(loss.item())

    # ── Target netwerk update ───────────────────────────────────────────────────

    def update_target_network(self):
        """Kopieer gewichten van online naar target netwerk."""
        self.target_net.load_state_dict(self.online_net.state_dict())

    # ── Epsilon aanpassen ───────────────────────────────────────────────────────

    def decay_epsilon(self):
        """Verlaag epsilon na elk episode."""
        self.epsilon = max(EPSILON_END, self.epsilon * EPSILON_DECAY)

    # ── Model opslaan/laden ─────────────────────────────────────────────────────

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save({
            "online_state_dict":  self.online_net.state_dict(),
            "target_state_dict":  self.target_net.state_dict(),
            "optimizer_state":    self.optimizer.state_dict(),
            "epsilon":            self.epsilon,
            "train_steps":        self.train_steps,
        }, path)
        print(f"Model opgeslagen: {path}")

    def load(self, path: str):
        checkpoint = torch.load(path, map_location=self.device, weights_only=False)  # nosec B614
        self.online_net.load_state_dict(checkpoint["online_state_dict"])
        self.target_net.load_state_dict(checkpoint["target_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state"])
        self.epsilon    = checkpoint["epsilon"]
        self.train_steps = checkpoint["train_steps"]
        print(f"Model geladen: {path} (epsilon={self.epsilon:.3f})")

    def get_q_values(self, state: np.ndarray) -> np.ndarray:
        """Geeft Q-waarden terug voor diagnose/logging."""
        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q = self.online_net(state_t)
        return q.cpu().numpy().flatten()
