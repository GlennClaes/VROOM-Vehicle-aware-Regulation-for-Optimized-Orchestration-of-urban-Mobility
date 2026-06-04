"""
sumo_env.py — Gymnasium Environment voor SUMO verkeerslicht-besturing via TraCI
Gecorrigeerd voor Hasselt XL met dynamische lane-detectie en vaste state-dimensie.

Wijzigingen t.o.v. vorige versie:
  - wait_penalty geschaald van /1000 naar /100 (10x zwaarder)
  - improvement_bonus ook negatief bij verslechtering
  - throughput_bonus licht verhoogd
  - Huidige fase toegevoegd aan observatie (26-dim)
  - _safe_lane() helper om TraCI crashes te vermijden
"""

import os
import sys
import time
import numpy as np
import gymnasium as gym
from gymnasium import spaces

# ─── TraCI importeren ──────────────────────────────────────────────────────────
SUMO_HOME = os.environ.get("SUMO_HOME", "")
if SUMO_HOME:
    tools = os.path.join(SUMO_HOME, "tools")
    if tools not in sys.path:
        sys.path.append(tools)

try:
    import traci # noqa: E402
    import traci.exceptions # noqa: E402
except ImportError:
    raise ImportError(
        "TraCI niet gevonden! Zorg dat SUMO_HOME correct is ingesteld."
    )

# ─── Docker vs lokaal detectie ────────────────────────────────────────────────
SUMO_HOST = os.environ.get("SUMO_HOST", None)
SUMO_PORT = int(os.environ.get("SUMO_PORT", "8813"))

# ─── Constanten ────────────────────────────────────────────────────────────────
TRAFFIC_LIGHT_ID = "joinedS_cluster_192603469_255381549_3903527581_cluster_2385586901_255381611_32904045"
PHASES            = [0, 2, 4, 6]
YELLOW_PHASE_MAP  = {0: 1, 2: 3, 4: 5, 6: 7}
YELLOW_DURATION   = 5
MIN_GREEN         = 10
MAX_GREEN         = 60
SIM_STEP          = 1.0
STEPS_PER_ACTION  = 10
MAX_EPISODE_STEPS = 3600

# Maximale wachtrij per lane voor normalisatie
MAX_QUEUE_PER_LANE = 50.0

INCOMING_LANES_REFERENCE = [
    "338729211#0_2", "387014575#0_0", "230031918#0_1", "245515786#0_1",
    "338729199#0_0", "338729199#0_1", "245515786#0_2", "338729199#0_2",
    "245515787#0_0", "358515239#0_0", "358515239#0_1", "358515239#0_2",
    "338729211#0_0", "338729211#0_1", "387014575#0_1", "387014575#0_2",
    "230031918#0_0", "230031918#0_2", "245515786#0_0", "245515787#0_1",
    "245515787#0_2", "245516001#0_1", "245516001#0_2", "303569278#0_1",
    "303569278#0_2"
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SUMOCFG    = os.path.join(SCRIPT_DIR, "..", "scenarios", "hasselt_xl", "osm.sumocfg")


# ─── Environment ───────────────────────────────────────────────────────────────

class SumoIntersectionEnv(gym.Env):

    metadata = {"render_modes": ["human", "none"]}

    def __init__(self, use_gui: bool = False, render_mode: str = "none",
                 sumocfg: str = SUMOCFG, port: int = 8813):
        super().__init__()

        self.use_gui       = use_gui
        self.render_mode   = render_mode
        self.sumocfg       = sumocfg
        self.port          = port
        self._sumo_process = None
        self._label        = f"sumo_{port}"

        # Observatie: 25 lane-wachtrijen (genormaliseerd 0–1)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0,
            shape=(25,),
            dtype=np.float32
        )
        self.action_space = spaces.Discrete(len(PHASES))

        self._step_count       = 0
        self._current_phase    = 0
        self._yellow_active    = False
        self._yellow_remaining = 0
        self._time_since_switch = 0
        self._prev_queue       = 0.0
        self._episode_reward   = 0.0
        self._sumo_running     = False
        self.lanes_to_monitor  = []

    # ── Helper: veilig lane-data opvragen ──────────────────────────────────────

    def _safe_lane(self, fn, lane: str, default=0.0):
        """Wrapper om TraCI-crashes op ongeldige lanes op te vangen."""
        try:
            return fn(lane)
        except Exception:
            return default

    # ── Reset ──────────────────────────────────────────────────────────────────

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        if self._sumo_running:
            try:
                traci.close(self._label)
            except Exception:
                pass
            self._sumo_running = False

        try:
            traci.close(self._label)
        except Exception:
            pass
        time.sleep(1)

        if SUMO_HOST:
            print(f"[TraCI] Verbinden met Docker SUMO op {SUMO_HOST}:{self.port}...")
            traci.connect(port=self.port, host=SUMO_HOST)
        else:
            sumo_binary = "sumo-gui" if self.use_gui else "sumo"
            sumo_cmd = [
                sumo_binary, "-c", self.sumocfg,
                "--start", "true", "--quit-on-end", "true",
                "--no-step-log", "true", "--no-warnings", "true",
                "--no-internal-links", "true", "--message-log.disable", "true",
                "--waiting-time-memory", "1000", "--random", "true"

            ]

            print("[TraCI] SUMO laden (Hasselt XL)...")
            try:
                traci.start(sumo_cmd, port=self.port, numRetries=10, label=self._label)
            except Exception:
                try:
                    traci.close(self._label)
                except Exception:
                    pass
                time.sleep(3)
                traci.start(sumo_cmd, port=self.port, numRetries=10, label=self._label)

            time.sleep(3)

        self._sumo_running = True

        try:
            raw_lanes = traci.trafficlight.getControlledLanes(TRAFFIC_LIGHT_ID)
            self.lanes_to_monitor = list(dict.fromkeys(raw_lanes))
            print(f"[TraCI] Verbonden! Monitor {len(self.lanes_to_monitor)} lanes.")
        except traci.TraCIException:
            print("[WAARSCHUWING] Kon geen lanes ophalen, gebruik fallback lijst.")
            self.lanes_to_monitor = INCOMING_LANES_REFERENCE

        self._step_count       = 0
        self._current_phase    = 0
        self._yellow_active    = False
        self._yellow_remaining = 0
        self._time_since_switch = 0
        self._prev_queue       = 0.0
        self._episode_reward   = 0.0

        try:
            traci.trafficlight.setPhase(TRAFFIC_LIGHT_ID, PHASES[self._current_phase])
        except Exception:
            pass

        return self._get_observation(), {}

    # ── Step ───────────────────────────────────────────────────────────────────

    def step(self, action: int):
        assert self._sumo_running, "Aanroep reset() vereist"

        desired_phase = action

        if desired_phase != self._current_phase and not self._yellow_active:
            if self._time_since_switch >= 10:
                try:
                    yellow_phase = YELLOW_PHASE_MAP[PHASES[self._current_phase]]
                    traci.trafficlight.setPhase(TRAFFIC_LIGHT_ID, yellow_phase)
                    self._yellow_active    = True
                    self._yellow_remaining = YELLOW_DURATION
                    self._time_since_switch = 0
                except Exception:
                    pass

        for _ in range(STEPS_PER_ACTION):
            self._time_since_switch += 1
            if self._yellow_active:
                self._yellow_remaining -= 1
                if self._yellow_remaining <= 0:
                    self._yellow_active = False
                    self._current_phase = desired_phase
                    try:
                        traci.trafficlight.setPhase(TRAFFIC_LIGHT_ID, PHASES[self._current_phase])
                    except Exception:
                        pass
            traci.simulationStep()
            self._step_count += 1

        obs         = self._get_observation()
        total_queue = float(np.sum(obs[:25]) * MAX_QUEUE_PER_LANE)
        reward      = self._compute_reward(total_queue)

        self._prev_queue      = total_queue
        self._episode_reward += reward

        terminated = self._step_count >= MAX_EPISODE_STEPS

        if terminated:
            try:
                traci.close(self._label)
            except Exception:
                pass
            self._sumo_running = False

        return obs, reward, terminated, False, {
            "total_queue": total_queue,
            "step":        self._step_count,
        }

    # ── Observatie ─────────────────────────────────────────────────────────────

    def _get_observation(self) -> np.ndarray:
        queues = []
        for lane in self.lanes_to_monitor:
            q = self._safe_lane(traci.lane.getLastStepHaltingNumber, lane, 0)
            queues.append(min(q / MAX_QUEUE_PER_LANE, 1.0))

        obs_array  = np.zeros(25, dtype=np.float32)
        valid_data = np.array(queues[:25], dtype=np.float32)
        obs_array[:len(valid_data)] = valid_data

        return obs_array

    # ── Reward ─────────────────────────────────────────────────────────────────

    def _compute_reward(self, total_queue: float) -> float:
        """
        Reward-functie met gecorrigeerde schaalverhoudingen.

        Alle componenten zitten nu in vergelijkbare orde van grootte (~0–5).

        Componenten:
            queue_penalty    : straf voor totale wachtrij          (schaal: 0–5)
            wait_penalty     : straf voor cumulatieve wachttijd    (schaal: 0–5)  ← was /1000, nu /100
            throughput_bonus : beloning voor doorgereden voertuigen (schaal: 0–2)
            improvement_bonus: beloning voor verbetering,
                               straf voor verslechtering            (schaal: -1..+1)  ← nu ook negatief
        """

        # 1. Straf voor wachtrij (ongewijzigd)
        queue_penalty = -total_queue / MAX_QUEUE_PER_LANE

        # 2. Straf voor wachttijd
        # FIX: gedeeld door 100 i.p.v. 1000 → 10x meer gewicht
        waiting_time = sum(
            self._safe_lane(traci.lane.getWaitingTime, lane, 0.0)
            for lane in self.lanes_to_monitor
        )
        wait_penalty = -(waiting_time / 100.0)

        # 3. Bonus voor doorstroming
        # FIX: factor 0.2 i.p.v. 0.1 → iets meer aanmoediging voor doorstroom
        throughput       = traci.simulation.getArrivedNumber()
        throughput_bonus = throughput * 0.2

        # 4. Bonus voor verbetering
        improvement_bonus = (self._prev_queue - total_queue) / 10.0

        # 5. Straf voor groen licht op een lege lane (inefficiëntie)
        empty_green_penalty = 0.0
        try:
            state_str = traci.trafficlight.getRedYellowGreenState(TRAFFIC_LIGHT_ID)
            controlled_lanes = traci.trafficlight.getControlledLanes(TRAFFIC_LIGHT_ID)
            for i, char in enumerate(state_str):
                if char.lower() == 'g': # Groen
                    lane = controlled_lanes[i]
                    q = self._safe_lane(traci.lane.getLastStepHaltingNumber, lane, 0)
                    if q == 0:
                        empty_green_penalty -= 0.1 # Kleine straf per lege groene lane
        except Exception:
            pass

        reward = queue_penalty + wait_penalty + throughput_bonus + improvement_bonus + empty_green_penalty

        return float(reward)

    # ── Close ──────────────────────────────────────────────────────────────────

    def close(self):
        if self._sumo_running:
            try:
                traci.close(self._label)
            except Exception:
                try:
                    traci.close()
                except Exception:
                    pass
            self._sumo_running = False


if __name__ == "__main__":
    env = SumoIntersectionEnv(use_gui=False)
    obs, info = env.reset()
    print(f"Observatie shape: {obs.shape} (moet 25 zijn)")
    env.close()
