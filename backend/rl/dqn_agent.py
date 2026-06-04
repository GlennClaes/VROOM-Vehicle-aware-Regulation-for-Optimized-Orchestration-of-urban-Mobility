"""
dqn_agent.py — Dueling Double DQN (D3QN) voor Universele Verkeerslichtbesturing
Geoptimaliseerd voor stabiliteit in complexe multi-intersection netwerken.

FIXES (v2):
  3. EPSILON_DECAY  0.992 → 0.995  (trager afbouwen voor 28 intersections)
  4. EPSILON_END    0.05  → 0.1    (meer exploratie behouden)
  4. Target network nu step-based (elke 1000 train steps) i.p.v. episode-based
"""

import os
import random
import numpy as np

import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F


# ─── Hyperparameters ───────────────────────────────────────────────────────────

HIDDEN_SIZE          = 256
LEARNING_RATE        = 3e-4
GAMMA                = 0.99
EPSILON_START        = 1.0
EPSILON_END          = 0.05
EPSILON_DECAY        = 0.997
MEMORY_SIZE          = 50_000
BATCH_SIZE           = 512
TARGET_UPDATE_STEPS  = 3000

# PER Hyperparameters
PER_ALPHA            = 0.6    # Priority exponent
PER_BETA_START       = 0.4    # Importance sampling exponent
PER_BETA_END         = 1.0
PER_BETA_STEPS       = 20_000 # Steps to reach PER_BETA_END


# ─── Noisy Layer (for robustness) ─────────────────────────────────────────────

class NoisyLinear(nn.Linear):
    """
    Noisy Linear Layer from 'Noisy Networks for Exploration'.
    Adds parametric noise to weights to improve exploration and robustness.
    """
    def __init__(self, in_features, out_features, sigma_init=0.5, bias=True):
        self.sigma_init = sigma_init
        super(NoisyLinear, self).__init__(in_features, out_features, bias=bias)
        self.sigma_init = sigma_init
        self.register_buffer('epsilon_weight', torch.zeros(out_features, in_features))
        if bias:
            self.register_buffer('epsilon_bias', torch.zeros(out_features))
        
        self.sigma_weight = nn.Parameter(torch.full((out_features, in_features), sigma_init))
        if bias:
            self.sigma_bias = nn.Parameter(torch.full((out_features,), sigma_init))
        
        self.reset_parameters()
        self.reset_noise()

    def reset_parameters(self):
        std = 1.0 / np.sqrt(self.in_features)
        self.weight.data.uniform_(-std, std)
        if hasattr(self, 'sigma_weight'):
            self.sigma_weight.data.fill_(self.sigma_init * std)
        if self.bias is not None:
            self.bias.data.uniform_(-std, std)
            if hasattr(self, 'sigma_bias'):
                self.sigma_bias.data.fill_(self.sigma_init * std)

    def reset_noise(self):
        epsilon_in = self._scale_noise(self.in_features)
        epsilon_out = self._scale_noise(self.out_features)
        self.epsilon_weight.copy_(epsilon_out.ger(epsilon_in))
        if self.bias is not None:
            self.epsilon_bias.copy_(epsilon_out)

    def _scale_noise(self, size):
        x = torch.randn(size)
        return x.sign().mul(x.abs().sqrt())

    def forward(self, input):
        if self.training:
            weight = self.weight + self.sigma_weight * self.epsilon_weight
            bias = self.bias
            if bias is not None:
                bias = bias + self.sigma_bias * self.epsilon_bias
            return F.linear(input, weight, bias)
        else:
            return F.linear(input, self.weight, self.bias)


# ─── Neuraal Netwerk (Dueling) ─────────────────────────────────────────────────

class DuelingDQNNetwork(nn.Module):
    """
    Dueling DQN Architectuur:
    Splitst Q(s,a) in V(s) (state value) en A(s,a) (action advantage).

    Input:  state_dim  (= 35)
    Output: action_dim (= 8 mogelijke fasen)
    """

    def __init__(self, state_dim: int, action_dim: int):
        super().__init__()

        # Shared Feature Extraction
        self.feature_layer = nn.Sequential(
            nn.Linear(state_dim, HIDDEN_SIZE),
            nn.ReLU(),
            nn.Linear(HIDDEN_SIZE, HIDDEN_SIZE),
            nn.ReLU()
        )

        # Value Stream (V) - Noisy for better exploration
        self.value_stream = nn.Sequential(
            NoisyLinear(HIDDEN_SIZE, HIDDEN_SIZE // 2),
            nn.ReLU(),
            NoisyLinear(HIDDEN_SIZE // 2, 1)
        )

        # Advantage Stream (A) - Noisy for better exploration
        self.advantage_stream = nn.Sequential(
            NoisyLinear(HIDDEN_SIZE, HIDDEN_SIZE // 2),
            nn.ReLU(),
            NoisyLinear(HIDDEN_SIZE // 2, action_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features  = self.feature_layer(x)
        value     = self.value_stream(features)
        advantage = self.advantage_stream(features)

        # Q(s,a) = V(s) + (A(s,a) - mean(A(s,a)))
        q_values = value + (advantage - advantage.mean(dim=1, keepdim=True))
        return q_values

    def reset_noise(self):
        """Reset noise for all noisy layers in the network."""
        for layer in self.value_stream:
            if isinstance(layer, NoisyLinear):
                layer.reset_noise()
        for layer in self.advantage_stream:
            if isinstance(layer, NoisyLinear):
                layer.reset_noise()


# ─── Replay Buffer ─────────────────────────────────────────────────────────────

class PrioritizedReplayBuffer:
    """
    Prioritized Experience Replay Buffer (PER).
    Stores transitions and their priorities for non-uniform sampling.
    """
    def __init__(self, capacity: int, alpha: float = PER_ALPHA):
        self.capacity = capacity
        self.alpha = alpha
        self.buffer = []
        self.pos = 0
        self.priorities = np.zeros((capacity,), dtype=np.float32)

    def push(self, state, action, reward, next_state, done):
        max_prio = self.priorities.max() if self.buffer else 1.0
        
        if len(self.buffer) < self.capacity:
            self.buffer.append((state, action, reward, next_state, done))
        else:
            self.buffer[self.pos] = (state, action, reward, next_state, done)
        
        self.priorities[self.pos] = max_prio
        self.pos = (self.pos + 1) % self.capacity

    def sample(self, batch_size: int, beta: float = 0.4):
        if len(self.buffer) == self.capacity:
            prios = self.priorities
        else:
            prios = self.priorities[:self.pos]
        
        probs = prios ** self.alpha
        probs /= probs.sum()
        
        indices = np.random.choice(len(self.buffer), batch_size, p=probs)
        samples = [self.buffer[idx] for idx in indices]
        
        total = len(self.buffer)
        weights = (total * probs[indices]) ** (-beta)
        weights /= weights.max()
        weights = np.array(weights, dtype=np.float32)
        
        states, actions, rewards, next_states, dones = zip(*samples)
        return (
            np.array(states,      dtype=np.float32),
            np.array(actions,     dtype=np.int64),
            np.array(rewards,     dtype=np.float32),
            np.array(next_states, dtype=np.float32),
            np.array(dones,       dtype=np.float32),
            indices,
            weights
        )

    def update_priorities(self, batch_indices, batch_priorities):
        for idx, prio in zip(batch_indices, batch_priorities):
            self.priorities[idx] = prio

    def __len__(self):
        return len(self.buffer)


# ─── DQN Agent ─────────────────────────────────────────────────────────────────

class DQNAgent:
    def __init__(self, state_dim: int, action_dim: int, device: str = "auto"):
        self.state_dim  = state_dim
        self.action_dim = action_dim
        self.device     = torch.device(
            "cuda" if (device == "auto" and torch.cuda.is_available()) else "cpu"
        )

        # Netwerken (Dueling)
        self.online_net = DuelingDQNNetwork(state_dim, action_dim).to(self.device)
        self.target_net = DuelingDQNNetwork(state_dim, action_dim).to(self.device)
        self.target_net.load_state_dict(self.online_net.state_dict())
        self.target_net.eval()

        self.optimizer   = optim.Adam(self.online_net.parameters(), lr=LEARNING_RATE)
        self.memory      = PrioritizedReplayBuffer(MEMORY_SIZE)
        self.epsilon     = EPSILON_START
        self.train_steps = 0
        self.beta        = PER_BETA_START

        print(f"D3QN Agent (PN_D3QN: Noisy Dueling Double DQN + PER) actief op {self.device}")
        print(f"  eps start={EPSILON_START}, end={EPSILON_END}, decay={EPSILON_DECAY}")
        print(f"  Target update elke {TARGET_UPDATE_STEPS} train-steps")

    # ── Actieselectie ──────────────────────────────────────────────────────────

    def select_action(self, state: np.ndarray, training: bool = True, fallback_action: int = None) -> int:
        # Noisy layers handle exploration, but we keep epsilon for safety/initial randomness
        if training and random.random() < self.epsilon:
            if fallback_action is not None:
                return fallback_action
            return random.randint(0, self.action_dim - 1)

        state_t = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            q_values = self.online_net(state_t)
        return int(q_values.argmax(dim=1).item())

    # ── Geheugen ───────────────────────────────────────────────────────────────

    def remember(self, state, action, reward, next_state, done):
        self.memory.push(state, action, reward, next_state, done)

    # ── Train stap ─────────────────────────────────────────────────────────────

    def train_step(self) -> float:
        """
        PN_D3QN Update:
        - Double DQN + Dueling + Noisy Layers
        - Prioritized Experience Replay (PER) with Importance Sampling
        """
        if len(self.memory) < BATCH_SIZE:
            return 0.0

        # Sample with PER (using current beta)
        states, actions, rewards, next_states, dones, indices, weights = self.memory.sample(BATCH_SIZE, self.beta)

        states_t      = torch.FloatTensor(states).to(self.device)
        actions_t     = torch.LongTensor(actions).unsqueeze(1).to(self.device)
        rewards_t     = torch.FloatTensor(rewards).unsqueeze(1).to(self.device)
        next_states_t = torch.FloatTensor(next_states).to(self.device)
        dones_t       = torch.FloatTensor(dones).unsqueeze(1).to(self.device)
        weights_t     = torch.FloatTensor(weights).unsqueeze(1).to(self.device)

        # Reset noise for stochastic exploration
        self.online_net.reset_noise()
        self.target_net.reset_noise()

        # Current Q-values
        current_q = self.online_net(states_t).gather(1, actions_t)

        # Double DQN evaluation
        with torch.no_grad():
            next_actions = self.online_net(next_states_t).argmax(dim=1, keepdim=True)
            next_q       = self.target_net(next_states_t).gather(1, next_actions)
            target_q     = rewards_t + GAMMA * next_q * (1 - dones_t)

        # TD Error for priority updates
        td_errors = (target_q - current_q).abs().detach().cpu().numpy()
        self.memory.update_priorities(indices, td_errors.flatten() + 1e-6)

        # Weighted Loss (Importance Sampling)
        loss = (weights_t * F.smooth_l1_loss(current_q, target_q, reduction='none')).mean()
        
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.online_net.parameters(), 10.0)
        self.optimizer.step()

        self.train_steps += 1
        
        # Decay beta for importance sampling
        self.beta = min(PER_BETA_END, self.beta + (PER_BETA_END - PER_BETA_START) / PER_BETA_STEPS)

        # Step-based target update
        if self.train_steps % TARGET_UPDATE_STEPS == 0:
            self.update_target_network()

        return float(loss.item())

    # ── Hulpfuncties ───────────────────────────────────────────────────────────

    def update_target_network(self):
        self.target_net.load_state_dict(self.online_net.state_dict())

    def decay_epsilon(self):
        self.epsilon = max(EPSILON_END, self.epsilon * EPSILON_DECAY)

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save({
            "online_state_dict": self.online_net.state_dict(),
            "target_state_dict": self.target_net.state_dict(),
            "optimizer_state":   self.optimizer.state_dict(),
            "epsilon":           self.epsilon,
            "train_steps":       self.train_steps,
        }, path)

    def load(self, path: str):
        checkpoint = torch.load(path, map_location=self.device, weights_only=False)  # nosec B614

        # Graceful loading: handle state_dim mismatches between saved and current model
        try:
            self.online_net.load_state_dict(checkpoint["online_state_dict"])
            self.target_net.load_state_dict(checkpoint["target_state_dict"])
        except RuntimeError as e:
            if "size mismatch" in str(e):
                print("[D3QN] Architecture mismatch detected, loading compatible layers...")
                # Load only matching keys (strict=False)
                online_state = checkpoint["online_state_dict"]
                target_state = checkpoint["target_state_dict"]

                current_online = self.online_net.state_dict()
                current_target = self.target_net.state_dict()

                # Filter: only load weights that match in shape
                compatible_online = {
                    k: v for k, v in online_state.items()
                    if k in current_online and v.shape == current_online[k].shape
                }
                compatible_target = {
                    k: v for k, v in target_state.items()
                    if k in current_target and v.shape == current_target[k].shape
                }

                current_online.update(compatible_online)
                current_target.update(compatible_target)

                self.online_net.load_state_dict(current_online)
                self.target_net.load_state_dict(current_target)

                loaded = len(compatible_online)
                total = len(online_state)
                print(f"[D3QN] Loaded {loaded}/{total} compatible layers. "
                      f"Mismatched layers reinitialized with random weights.")
            else:
                raise

        self.epsilon     = checkpoint.get("epsilon", EPSILON_START)
        self.train_steps = checkpoint.get("train_steps", 0)
        print(f"D3QN Model geladen: {path}  (eps={self.epsilon:.3f}, steps={self.train_steps})")