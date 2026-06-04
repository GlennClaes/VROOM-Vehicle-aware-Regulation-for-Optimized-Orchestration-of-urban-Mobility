"""
sumo_env.py — Universele Multi-Intersection Gymnasium Environment voor SUMO
Bestuurt ALLE verkeerslichten in Hasselt XL tegelijk voor optimale doorstroming.

Verbeteringen t.o.v. v1:
  • Per-lane observatie: queue, voertuigcount, wachttijd, snelheid (4 features/lane)
  • Kruispunt-context: druk van naburige TLS opgenomen in state
  • Rijkere reward: ook gemiddelde wachttijd afstraffen
  • State dim: 8 lanes × 4 features + phase + intensity + buurdruk = 35

Compatibel met train_local.py → verander state_dim=27 naar state_dim=35.
"""

import os
import sys
import random
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
    import traci
    import traci.exceptions
except ImportError:
    raise ImportError("TraCI niet gevonden! Zorg dat SUMO_HOME correct is ingesteld.")

# ─── Constanten ────────────────────────────────────────────────────────────────
YELLOW_DURATION    = 3.0
SIM_STEP           = 1.0
STEPS_PER_ACTION   = 10
MAX_EPISODE_STEPS  = 3600

# Normalisatiegrenzen per feature
MAX_QUEUE_PER_LANE = 50.0   # voertuigen stilstaand
MAX_VEH_PER_LANE   = 60.0   # totaal voertuigen op lane
MAX_WAIT_TIME      = 300.0  # seconden cumulatieve wachttijd
MAX_SPEED          = 15.0   # m/s (~54 km/u stadsverkeer)

# Observatiestructuur
MAX_LANES_OBS      = 8      # max incoming lanes per TLS in de state
FEATURES_PER_LANE  = 4      # queue_norm, count_norm, wait_norm, speed_norm
LANE_BLOCK         = MAX_LANES_OBS * FEATURES_PER_LANE   # = 32
MAX_PHASES_ONEHOT  = 12     # max green phases in one-hot
GLOBAL_FEATURES    = MAX_PHASES_ONEHOT + 4  # phase_oh(12), min_green(1), intensity(1), pressure(1), last_action_mask(1)
STATE_DIM          = LANE_BLOCK + GLOBAL_FEATURES         # = 48

# TraCI Subscription Variabelen
VAR_HALTING_NUMBER = 0x14   # stilstaande voertuigen
VAR_VEHICLE_NUMBER = 0x10   # totaal voertuigen
VAR_WAITING_TIME   = 0x7a   # gesommeerde wachttijd (s)
VAR_MEAN_SPEED     = 0x11   # gemiddelde snelheid (m/s)

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
SCENARIOS_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "scenarios", "hasselt_xl"))

SCENARIOS = {
    "rush_hour": os.path.join(SCENARIOS_DIR, "rush_hour.sumocfg"),
    "normal":    os.path.join(SCENARIOS_DIR, "normal.sumocfg"),
    "quiet":     os.path.join(SCENARIOS_DIR, "quiet.sumocfg"),
    "night":     os.path.join(SCENARIOS_DIR, "night.sumocfg"),
}

INTENSITY_MAP = {"night": 0.2, "quiet": 0.4, "normal": 0.7, "rush_hour": 1.0}


# ─── Environment ───────────────────────────────────────────────────────────────

class SumoIntersectionEnv(gym.Env):
    metadata = {"render_modes": ["human", "none"]}

    def __init__(self, use_gui: bool = False, sumocfg: str = None, port: int = 8813):
        super().__init__()
        self.use_gui      = use_gui
        self.port         = port
        self.sumocfg_base = sumocfg
        self._label       = f"sumo_{port}"
        self._sumo_running = False

        # State: 35 features per TLS
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(STATE_DIM,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(8)

        self.tls_ids    = []
        self.all_lanes  = set()
        self.tls_info   = {}
        self.neighbors  = {}   # tls_id → [naburige tls_ids]
        self.last_queues = {}  # tls_id → total_queue (voor reward diff)
        self._step_count = 0
        self._intensity  = 0.5

    # ── Detectie & Initialisatie ────────────────────────────────────────────────

    def _detect_tls(self):
        """
        Haalt alle TLS op, detecteert incoming/outgoing lanes,
        bepaalt naburige kruispunten en start bulk subscriptions.
        """
        all_tls = traci.trafficlight.getIDList()
        self.tls_ids   = list(all_tls)
        self.tls_info  = {}
        self.all_lanes = set()
        self.tls_lane_map = {}

        # Stap 1: bouw lane-info per TLS
        for tls_id in self.tls_ids:
            try:
                # Get unique lanes, but ensure spatial coverage (max 8 lanes)
                unique_lanes = list(dict.fromkeys(traci.trafficlight.getControlledLanes(tls_id)))
                
                if len(unique_lanes) <= 8:
                    selected_lanes = unique_lanes
                else:
                    # Group by edge to pick representative lanes from all directions
                    edge_groups = {}
                    for l in unique_lanes:
                        edge_id = l.split('_')[0] if '_' in l else l
                        if edge_id not in edge_groups: edge_groups[edge_id] = []
                        edge_groups[edge_id].append(l)
                    
                    selected_lanes = []
                    for eid in edge_groups:
                        if len(selected_lanes) < 8:
                            selected_lanes.append(edge_groups[eid][0])
                    for eid in edge_groups:
                        for i in range(1, len(edge_groups[eid])):
                            if len(selected_lanes) < 8:
                                selected_lanes.append(edge_groups[eid][i])
                
                for lane in selected_lanes:
                    traci.lane.subscribe(lane, [VAR_VEHICLE_NUMBER, VAR_HALTING_NUMBER, VAR_WAITING_TIME, VAR_MEAN_SPEED])
                
                self.tls_lane_map[tls_id] = selected_lanes

                links = traci.trafficlight.getControlledLinks(tls_id)
                incoming = sorted(list(set(link[0][0] for link in links if link)))
                outgoing = sorted(list(set(link[0][1] for link in links if link)))

                for lane in incoming:
                    self.all_lanes.add(lane)
                for lane in outgoing:
                    self.all_lanes.add(lane)

                logic = traci.trafficlight.getAllProgramLogics(tls_id)[0]
                n_phases = len(logic.phases)

                # Groenfasen = fasen die groen bevatten (g of G) maar GEEN geel (y of Y)
                green_phases = [
                    i for i, p in enumerate(logic.phases)
                    if ('g' in p.state or 'G' in p.state) and 'y' not in p.state and 'Y' not in p.state
                ]
                if not green_phases:
                    green_phases = [i for i in range(n_phases) if i % 2 == 0]
                if not green_phases:
                    green_phases = [0]

                self.tls_info[tls_id] = {
                    "incoming":          incoming,
                    "outgoing":          outgoing,
                    "n_phases":          n_phases,
                    "green_phases":      green_phases,
                    "phase_to_lanes":    {},  # fase_idx -> [lijst van inkomende lanes die groen zijn]
                    "current_phase_idx": 0,
                    "yellow_active":     False,
                    "yellow_timer":      0,
                    "pending_green":     green_phases[0],
                    "last_green":        {p: 0 for p in green_phases},
                    "time_since_switch": 0,
                    "just_switched":     False
                }

                # Vul phase_to_lanes
                for p_idx in range(n_phases):
                    state = logic.phases[p_idx].state
                    g_lanes = []
                    for i, char in enumerate(state):
                        if char.lower() == 'g':
                            # Zoek welke lane bij dit index hoort
                            link = links[i]
                            if link and link[0]:
                                g_lanes.append(link[0][0])
                    self.tls_info[tls_id]["phase_to_lanes"][p_idx] = list(set(g_lanes))

            except Exception as e:
                print(f"[WARN] TLS detectie mislukt voor {tls_id}: {e}")

        # Stap 2: bouw buur-graph (outgoing van A == incoming van B → A en B zijn buren)
        self._build_neighbor_graph()

        # Stap 3: bulk TraCI subscriptions voor alle lanes (snelste methode)
        for lane_id in self.all_lanes:
            traci.lane.subscribe(lane_id, [
                VAR_HALTING_NUMBER,
                VAR_VEHICLE_NUMBER,
                VAR_WAITING_TIME,
                VAR_MEAN_SPEED,
            ])

        print(f"[ENV] {len(self.tls_ids)} TLS gedetecteerd, "
              f"{len(self.all_lanes)} lanes gesubscribed.")

    def _build_neighbor_graph(self):
        """
        Bouwt een dict {tls_id: [buur_tls_ids]} op basis van
        gedeelde lanes (outgoing van A overlapt incoming van B).
        """
        # Maak snelle opzoektabel: lane → welke TLS heeft die als incoming
        lane_to_tls = {}
        for tls_id, info in self.tls_info.items():
            for lane in info["incoming"]:
                lane_to_tls.setdefault(lane, []).append(tls_id)

        self.neighbors = {tls_id: [] for tls_id in self.tls_ids}
        for tls_id, info in self.tls_info.items():
            seen = set()
            for lane in info["outgoing"]:
                for neighbor_id in lane_to_tls.get(lane, []):
                    if neighbor_id != tls_id and neighbor_id not in seen:
                        self.neighbors[tls_id].append(neighbor_id)
                        seen.add(neighbor_id)

    # ── Reset & Step ───────────────────────────────────────────────────────────

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        # Force close existing label before starting, even if we think it's not running
        try:
            traci.close(self._label)
        except Exception:
            pass

        scenario_key  = random.choice(list(SCENARIOS.keys()))
        self.sumocfg  = SCENARIOS[scenario_key]
        self.current_scenario = scenario_key
        self._intensity = INTENSITY_MAP[scenario_key]

        sumo_binary = "sumo-gui" if self.use_gui else "sumo"
        cmd = [
            sumo_binary, "-c", self.sumocfg,
            "--start", "true",
            "--quit-on-end", "true",
            "--no-step-log", "true",
            "--no-warnings", "true",
            "--random", "true",
        ]

        print(f"[SUMO] Start '{scenario_key}' scenario (intensity={self._intensity})...")
        
        try:
            traci.start(cmd, port=self.port, label=self._label)
            self._sumo_running = True
            self._step_count   = 0
            self._detect_tls()
        except Exception as e:
            print(f"[ERROR] TraCI start mislukt: {e}")
            self._sumo_running = False
            # Probeer nogmaals te sluiten om de label vrij te geven
            try:
                traci.close(self._label)
            except Exception:
                pass
            raise e

        return self._get_observations(), {}

    def step(self, actions: dict):
        """
        Voert acties uit voor alle TLS, simuleert STEPS_PER_ACTION stappen,
        geeft obs, rewards, terminated, truncated, info terug.
        """
        # ── Fase-wissels toepassen ──────────────────────────────────────────────
        for tls_id, action in actions.items():
            info = self.tls_info[tls_id]
            if info["yellow_active"]:
                continue  # Wacht tot geel afgelopen is

            # Enforce a minimum green time to prevent rapid oscillation (jitter)
            # Verhoogd naar 20 seconden voor meer stabiliteit en minder geel-irritatie
            if info.get("time_since_switch", 0) < 20:
                continue 

            available    = info["green_phases"]
            desired_green = available[action % len(available)]
            current_phase = traci.trafficlight.getPhase(tls_id)

            if desired_green != current_phase:
                try:
                    # Haal het actieve programma op
                    logic_id = traci.trafficlight.getProgram(tls_id)
                    all_logics = traci.trafficlight.getAllProgramLogics(tls_id)
                    logic = next((l for l in all_logics if l.programID == logic_id), all_logics[0])
                    
                    # Zoek naar een gele fase tussen de huidige en de gewenste groene fase
                    # We kijken eerst naar de directe opvolger (standaard SUMO gedrag)
                    yellow_candidate = (current_phase + 1) % len(logic.phases)
                    phase_state = logic.phases[yellow_candidate].state
                    
                    # Als de volgende fase geel is, gebruiken we die. 
                    # Anders springen we direct (of SUMO regelt de transitie zelf als we setPhase doen)
                    # Als de volgende fase geel is, gebruiken we die. 
                    if 'y' in phase_state.lower() or 'Y' in phase_state:
                        traci.trafficlight.setPhase(tls_id, yellow_candidate)
                        # FORCEER de duur in SUMO zelf naar exact YELLOW_DURATION
                        traci.trafficlight.setPhaseDuration(tls_id, float(YELLOW_DURATION))
                        
                        info["yellow_active"]  = True
                        info["yellow_timer"]   = int(YELLOW_DURATION)
                        info["pending_green"]  = desired_green
                    else:
                        # Directe sprong naar groen als er geen tussenliggend geel wordt gevonden
                        traci.trafficlight.setPhase(tls_id, desired_green)

                    info["time_since_switch"] = 0
                    info["just_switched"]     = True
                except Exception as e:
                    print(f"[ERROR] Fase-wissel glitch op {tls_id}: {e}")

        # ── Simulatiestappen + geel-afwikkeling ────────────────────────────────
        for _ in range(STEPS_PER_ACTION):
            for tls_id, info in self.tls_info.items():
                if info["yellow_active"]:
                    info["yellow_timer"] -= 1
                    # Alleen wisselen als we EXACT op 0 komen
                    if info["yellow_timer"] == 0:
                        try:
                            traci.trafficlight.setPhase(tls_id, info["pending_green"])
                            # Zet ook de groenduur op een hoge waarde zodat SUMO niet zelf gaat wisselen
                            traci.trafficlight.setPhaseDuration(tls_id, 999.0)
                        except Exception:
                            pass
                        info["yellow_active"] = False

            # Increment timers for all TLS
            for info in self.tls_info.values():
                info["time_since_switch"] += 1

            traci.simulationStep()
            self._step_count += 1

        # ── Observaties & beloningen ───────────────────────────────────────────
        obs     = self._get_observations()
        rewards = self._compute_rewards()

        # Verzamel gesimuleerde statistieken voor safety penalties en evaluatie
        info = {"emergency_braking": 0, "teleports": 0, "total_queue": 0}
        try:
            info["emergency_braking"] = traci.simulation.getEmergencyStoppingVehiclesNumber()
            info["teleports"] = traci.simulation.getStartingTeleportNumber()
            # Som van alle wachtende voertuigen op alle gesubscribed lanes
            sub = traci.lane.getAllSubscriptionResults()
            info["total_queue"] = sum(res.get(0x14, 0) for res in sub.values())
        except Exception:
            pass # Verbinding mogelijk al gesloten door SUMO zelf

        terminated = self._step_count >= MAX_EPISODE_STEPS
        if terminated:
            try:
                traci.close(self._label)
            except Exception:
                pass
            self._sumo_running = False

        return obs, rewards, terminated, False, info

    # ── Observaties ───────────────────────────────────────────────────────────

    def _get_observations(self) -> dict:
        """
        Bouwt per TLS een state-vector van STATE_DIM (35) features:
          [lane_0: queue, count, wait, speed]  × MAX_LANES_OBS (8 lanes)
          + phase_norm
          + intensity
          + neighbor_pressure_norm
        """
        sub = traci.lane.getAllSubscriptionResults()
        obs_dict = {}

        for tls_id, info in self.tls_info.items():
            lane_features = []
            selected_lanes = self.tls_lane_map.get(tls_id, [])

            for lane_id in selected_lanes[:MAX_LANES_OBS]:
                res  = sub.get(lane_id, {})

                queue = res.get(VAR_HALTING_NUMBER, 0)
                count = res.get(VAR_VEHICLE_NUMBER, 0)
                wait  = res.get(VAR_WAITING_TIME, 0.0)
                speed = res.get(VAR_MEAN_SPEED, MAX_SPEED)   # default = vrij rijden

                lane_features.extend([
                    min(queue / MAX_QUEUE_PER_LANE, 1.0),
                    min(count / MAX_VEH_PER_LANE,   1.0),
                    min(wait  / MAX_WAIT_TIME,       1.0),
                    # Speed omgekeerd: laag = druk, hoog = vrij → normaliseer als drukmaat
                    1.0 - min(speed / MAX_SPEED, 1.0),
                ])

            # Opvullen tot MAX_LANES_OBS × FEATURES_PER_LANE
            while len(lane_features) < LANE_BLOCK:
                lane_features.append(0.0)

            # Globale features
            curr_phase   = traci.trafficlight.getPhase(tls_id)
            # One-hot encoding voor de huidige fase (max 12 fasen)
            phase_oh = [0.0] * MAX_PHASES_ONEHOT
            if curr_phase < MAX_PHASES_ONEHOT:
                phase_oh[curr_phase] = 1.0
            
            # Indicator of we al even op groen staan (min-green heuristiek)
            # 15 stappen = 15 seconden (bij SIM_STEP=1.0)
            min_green_passed = 1.0 if info["time_since_switch"] >= 15 else 0.0
            
            neighbor_pressure = self._compute_neighbor_pressure(tls_id, sub)
            
            # Gecombineerde globale vector: phase_oh(12) + min_green(1) + intensity(1) + pressure(1) + yellow_active(1) = 16
            global_vec = phase_oh + [
                min_green_passed,
                float(self._intensity),
                float(neighbor_pressure),
                1.0 if info["yellow_active"] else 0.0
            ]

            obs_dict[tls_id] = np.array(
                lane_features + global_vec,
                dtype=np.float32,
            )

        return obs_dict

    def get_max_pressure_action(self, tls_id: str) -> int:
        """
        Heuristiek: bepaalt welke groene fase de hoogste 'druk' heeft 
        (aantal voertuigen op inkomende lanes die groen zouden krijgen).
        """
        info = self.tls_info.get(tls_id)
        if not info:
            return 0
        
        green_phases = info["green_phases"]
        if not green_phases:
            return 0
            
        sub = traci.lane.getAllSubscriptionResults()
        phase_pressures = []

        for p_idx in green_phases:
            lanes = info["phase_to_lanes"].get(p_idx, [])
            pressure = sum(sub.get(lid, {}).get(VAR_VEHICLE_NUMBER, 0) for lid in lanes)
            phase_pressures.append(pressure)
        
        # Kies de index van de fase met de hoogste druk
        best_idx = np.argmax(phase_pressures)
        return int(best_idx)

    def _compute_neighbor_pressure(self, tls_id: str, sub: dict) -> float:
        """
        Gemiddelde genormaliseerde wachtrij-druk van naburige kruispunten.
        Geeft de agent context over wat er stroomafwaarts wacht.
        """
        neighbor_ids = self.neighbors.get(tls_id, [])
        if not neighbor_ids:
            return 0.0

        pressures = []
        for nid in neighbor_ids:
            ninfo = self.tls_info.get(nid)
            if not ninfo:
                continue
            total_q = sum(
                sub.get(lid, {}).get(VAR_HALTING_NUMBER, 0)
                for lid in ninfo["incoming"]
            )
            # Normaliseer op basis van aantal lanes × max queue
            n_lanes = max(len(ninfo["incoming"]), 1)
            pressures.append(min(total_q / (n_lanes * MAX_QUEUE_PER_LANE), 1.0))

        return float(np.mean(pressures)) if pressures else 0.0

    # ── Beloningen ────────────────────────────────────────────────────────────

    def _compute_rewards(self) -> dict:
        """
        Reward per TLS (gebaseerd op PN_D3QN paper):
          + diff_q (reductie in wachtrij t.o.v. vorige stap)
          + aangekomen voertuigen
          - huidige wachtrij & wachttijd
          - druk-disbalans
        """
        rewards    = {}
        arrived    = traci.simulation.getArrivedNumber()
        sub        = traci.lane.getAllSubscriptionResults()

        for tls_id, info in self.tls_info.items():
            inc_lanes = info["incoming"]
            out_lanes = info["outgoing"]
            n_in = max(len(inc_lanes), 1)

            # 1. Huidige stats (genormaliseerd per lane voor eerlijke vergelijking)
            q_total    = sum(sub.get(lane, {}).get(VAR_HALTING_NUMBER, 0) for lane in inc_lanes)
            wait_total = sum(sub.get(lane, {}).get(VAR_WAITING_TIME,   0) for lane in inc_lanes)
            # We gebruiken ook de gemiddelde snelheid als maatstaf voor doorstroming
            avg_speed  = np.mean([sub.get(lane, {}).get(VAR_MEAN_SPEED, 0) for lane in inc_lanes])
            
            q_norm     = q_total / n_in     # gemiddelde queue per lane
            wait_norm  = wait_total / n_in  # gemiddelde wachttijd per lane

            # 2. Queue Difference (Cruciaal voor PN_D3QN)
            prev_q = self.last_queues.get(tls_id, q_total)
            diff_q = prev_q - q_total  # Positief = wachtrij is korter geworden
            self.last_queues[tls_id] = q_total

            # 3. Druk (MaxPressure)
            in_count  = sum(sub.get(lane, {}).get(VAR_VEHICLE_NUMBER, 0) for lane in inc_lanes)
            out_count = sum(sub.get(lane, {}).get(VAR_VEHICLE_NUMBER, 0) for lane in out_lanes)
            pressure  = (in_count - out_count) / n_in

            # Gecombineerde reward (geoptimaliseerd voor betere doorstroming)
            reward = (
                  diff_q     *  2.5     # Beloning voor afname wachtrij (verhoogd)
                - q_norm     *  0.8     # Straf voor wachtrij (iets zwaarder)
                - wait_norm  *  0.05    # Straf voor wachttijd (vloeiender)
                + (avg_speed / MAX_SPEED) * 1.5  # Bonus voor doorstroming/snelheid
            )

            # Switching penalty: Alleen straffen als het zinloos is (bijv. bij een al lege wachtrij)
            if info.get("just_switched", False):
                penalty = 3.0 if q_total < 2 else 1.0  # Zwaardere straf voor nutteloos wisselen
                reward -= penalty
                info["just_switched"] = False

            rewards[tls_id] = float(reward)

        return rewards

    # ── Afsluiten ─────────────────────────────────────────────────────────────

    def close(self):
        if self._sumo_running:
            try:
                traci.close(self._label)
            except Exception:
                pass
            self._sumo_running = False