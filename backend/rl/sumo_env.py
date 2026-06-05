"""
sumo_env.py — Universele Multi-Intersection Gymnasium Environment voor SUMO
Bestuurt ALLE verkeerslichten in Hasselt XL tegelijk voor optimale doorstroming.

Refactored to use the unified object-oriented domain classes and CommunicationManager.
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

# Import unified architecture with robust fallback path
try:
    from rl.core.vroom_architecture import TrafficNetwork, Intersection, TrafficLight, MetricsCollector
except ImportError:
    try:
        from core.vroom_architecture import TrafficNetwork, Intersection, TrafficLight, MetricsCollector
    except ImportError:
        try:
            from app.rl.core.vroom_architecture import TrafficNetwork, Intersection, TrafficLight, MetricsCollector
        except ImportError:
            # Inline mock in case of emergency (prevents startup crash)
            class TrafficNetwork:
                def __init__(self):
                    self.intersections = {}
                    class CM:
                        def post_message(self, *a, **k): pass
                        def broadcast_status(self, *a, **k): pass
                        def query_central_registry(self, *a, **k): return None
                    self.comm_manager = CM()
                    class PE:
                        def record_flow(self, *a, **k): pass
                        def predict_flow(self, *a, **k): return 0.0
                        def compute_green_wave_offset(self, *a, **k): return 0.0
                        def calculate_queue_spillback_probability(self, *a, **k): return 0.0
                    self.prediction_engine = PE()
                def build_neighborhood_graph(self): pass
            class Intersection:
                def __init__(self, node_id, tl, inc, out):
                    self.id = node_id
                    self.traffic_light = tl
                    self.incoming_lanes = inc
                    self.outgoing_lanes = out
                    self.neighbor_ids = []
                    self.has_priority_vehicle = False
                    self.has_incident = False
                def update_sensor_data(self, traci_conn): pass
            class TrafficLight:
                def __init__(self, tls_id, green_phases, phase_to_lanes):
                    self.id = tls_id
                    self.green_phases = green_phases
                    self.phase_to_lanes = phase_to_lanes
                    self.current_phase_idx = 0
                    self.yellow_active = False
                    self.yellow_remaining = 0.0
                    self.green_step_counter = 0.0
                    self.step_counter = 0.0
                def tick(self, dt=1.0):
                    self.step_counter += dt
                def set_phase(self, phase_idx, conn, target):
                    self.current_phase_idx = phase_idx
            class MetricsCollector:
                def __init__(self): self.last_metrics = {}
                def update_metrics(self, *a, **k): pass
                def get_snapshot(self): return self.last_metrics

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

        # State: 48 features per TLS
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(STATE_DIM,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(8)

        self.tls_ids    = []
        self.all_lanes  = set()
        self.tls_info   = {}
        self.last_queues = {}  # tls_id → total_queue (voor reward diff)
        self._step_count = 0
        self._intensity  = 0.5
        self.current_scenario = "normal"
        
        # Unified components
        self.network = TrafficNetwork()
        self.metrics_collector = MetricsCollector()

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
        
        # Re-initialize network object
        self.network = TrafficNetwork()

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

                # Map phase to green lanes
                phase_to_lanes = {}
                for p_idx in range(n_phases):
                    state = logic.phases[p_idx].state
                    g_lanes = []
                    for i, char in enumerate(state):
                        if char.lower() == 'g':
                            link = links[i]
                            if link and link[0]:
                                g_lanes.append(link[0][0])
                    phase_to_lanes[p_idx] = list(set(g_lanes))

                # Instantiate new domain elements
                tl = TrafficLight(tls_id, green_phases, phase_to_lanes)
                tl.min_green = 20.0
                intersection = Intersection(tls_id, tl, incoming, outgoing)
                self.network.add_intersection(intersection)

                self.tls_info[tls_id] = {
                    "incoming":          incoming,
                    "outgoing":          outgoing,
                    "n_phases":          n_phases,
                    "green_phases":      green_phases,
                    "phase_to_lanes":    phase_to_lanes,
                    "current_phase_idx": 0,
                    "yellow_active":     False,
                    "yellow_timer":      0,
                    "pending_green":     green_phases[0],
                    "last_green":        {p: 0 for p in green_phases},
                    "time_since_switch": 0,
                    "just_switched":     False
                }

            except Exception as e:
                print(f"[WARN] TLS detectie mislukt voor {tls_id}: {e}")

        # Stap 2: bouw buur-graph in unified network
        self.network.build_neighborhood_graph()

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
            
            # Reset unified metrics collector
            self.metrics_collector = MetricsCollector()
            self.network.prediction_engine.clear()
        except Exception as e:
            print(f"[ERROR] TraCI start mislukt: {e}")
            self._sumo_running = False
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
            node = self.network.intersections.get(tls_id)
            if not node:
                continue

            tl = node.traffic_light

            if tl.yellow_active:
                # Update legacy local timers as well
                info["yellow_active"] = tl.yellow_active
                info["yellow_timer"] = int(tl.yellow_remaining)
                continue  # Wacht tot geel afgelopen is

            # Enforce minimum green time (legacy = 20s)
            if tl.green_step_counter < tl.min_green:
                continue 

            available    = info["green_phases"]
            desired_green = available[action % len(available)]
            current_phase = traci.trafficlight.getPhase(tls_id)

            if desired_green != current_phase:
                try:
                    tl.set_phase(action % len(available), traci, desired_green)
                    
                    # Sync back to legacy structures
                    info["yellow_active"]  = tl.yellow_active
                    info["yellow_timer"]   = int(tl.yellow_remaining)
                    info["pending_green"]  = desired_green
                    info["time_since_switch"] = 0
                    info["just_switched"]     = True
                except Exception as e:
                    print(f"[ERROR] Fase-wissel glitch op {tls_id}: {e}")

        # ── Simulatiestappen + geel-afwikkeling ────────────────────────────────
        for _ in range(STEPS_PER_ACTION):
            for tls_id, node in self.network.intersections.items():
                tl = node.traffic_light
                info = self.tls_info[tls_id]
                
                tl.tick(1.0)
                
                # Geel-countdown logic
                if tl.yellow_active and tl.yellow_remaining <= 0:
                    try:
                        traci.trafficlight.setPhase(tls_id, info["pending_green"])
                        traci.trafficlight.setPhaseDuration(tls_id, 999.0)
                    except: pass
                
                # Sync back to legacy
                info["yellow_active"] = tl.yellow_active
                info["yellow_timer"] = max(0, int(tl.yellow_remaining))
                info["time_since_switch"] = int(tl.green_step_counter)

            traci.simulationStep()
            self._step_count += 1

        # ── Update sensor data (Priority / Incident detection) ─────────────────
        for node in self.network.intersections.values():
            node.update_sensor_data(traci)

        # ── Observaties & beloningen ───────────────────────────────────────────
        obs     = self._get_observations()
        rewards = self._compute_rewards()

        # Update unified metrics
        active_vehicles = {}
        try:
            # Fetch active vehicles for metrics
            for vid in traci.vehicle.getIDList():
                try:
                    res = traci.vehicle.getSubscriptionResults(vid) or {}
                    active_vehicles[vid] = {
                        'waiting_time': res.get(0x7a, traci.vehicle.getWaitingTime(vid)),
                        'time_loss': res.get(0x8c, traci.vehicle.getTimeLoss(vid)),
                        'speed': res.get(0x40, traci.vehicle.getSpeed(vid)),
                        'departure': traci.vehicle.getDeparture(vid)
                    }
                except: pass
            
            arrived_ids = traci.simulation.getArrivedIDList()
            lane_subs = traci.lane.getAllSubscriptionResults()
            self.metrics_collector.update_metrics(traci, active_vehicles, arrived_ids, lane_subs, self.network)
        except Exception as e:
            pass

        info = {"emergency_braking": 0, "teleports": 0, "total_queue": 0}
        try:
            info["emergency_braking"] = traci.simulation.getEmergencyStoppingVehiclesNumber()
            info["teleports"] = traci.simulation.getStartingTeleportNumber()
            
            # Read updated metrics snapshot
            snapshot = self.metrics_collector.get_snapshot()
            info["total_queue"] = int(snapshot.get("aql", 0) * len(self.all_lanes))
            info["pressure"] = snapshot.get("pressure", 0)
            info["fairness"] = snapshot.get("fairness", 1.0)
        except Exception:
            pass

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
        Bouwt per TLS een state-vector van STATE_DIM (48) features:
          [lane_0: queue, count, wait, speed]  × MAX_LANES_OBS (8 lanes)
          + phase_norm
          + intensity
          + neighbor_pressure_norm (Enriched via CommunicationManager status messages)
        """
        sub = traci.lane.getAllSubscriptionResults()
        obs_dict = {}

        # ── COMM-STEP 1: Broadcast statuses for all intersections ──────────────
        for tls_id, node in self.network.intersections.items():
            selected_lanes = self.tls_lane_map.get(tls_id, [])
            
            lane_queues = {}
            lane_counts = {}
            for lid in selected_lanes:
                res = sub.get(lid, {})
                q = res.get(VAR_HALTING_NUMBER, 0)
                c = res.get(VAR_VEHICLE_NUMBER, 0)
                lane_queues[lid] = q
                lane_counts[lid] = c
                
                # Record flow into C++ prediction engine
                self.network.prediction_engine.record_flow(lid, c)

            # Predict flows using C++ or fallback Python engine
            predicted_flow = float(np.mean([self.network.prediction_engine.predict_flow(lid) for lid in selected_lanes])) if selected_lanes else 0.0

            # Publish status to CommunicationManager
            self.network.comm_manager.broadcast_status(tls_id, {
                "timestamp": self._step_count,
                "queues": lane_queues,
                "current_phase": traci.trafficlight.getPhase(tls_id),
                "priority_vehicle": node.has_priority_vehicle,
                "incident": node.has_incident,
                "predicted_flow": predicted_flow
            })

        # ── COMM-STEP 2: Compute states including communication data ───────────
        for tls_id, info in self.tls_info.items():
            lane_features = []
            selected_lanes = self.tls_lane_map.get(tls_id, [])

            for lane_id in selected_lanes[:MAX_LANES_OBS]:
                res  = sub.get(lane_id, {})

                queue = res.get(VAR_HALTING_NUMBER, 0)
                count = res.get(VAR_VEHICLE_NUMBER, 0)
                wait  = res.get(VAR_WAITING_TIME, 0.0)
                speed = res.get(VAR_MEAN_SPEED, MAX_SPEED)

                lane_features.extend([
                    min(queue / MAX_QUEUE_PER_LANE, 1.0),
                    min(count / MAX_VEH_PER_LANE,   1.0),
                    min(wait  / MAX_WAIT_TIME,       1.0),
                    1.0 - min(speed / MAX_SPEED, 1.0),
                ])

            # Opvullen tot MAX_LANES_OBS × FEATURES_PER_LANE
            while len(lane_features) < LANE_BLOCK:
                lane_features.append(0.0)

            # Globale features
            curr_phase   = traci.trafficlight.getPhase(tls_id)
            phase_oh = [0.0] * MAX_PHASES_ONEHOT
            if curr_phase < MAX_PHASES_ONEHOT:
                phase_oh[curr_phase] = 1.0
            
            min_green_passed = 1.0 if info["time_since_switch"] >= 15 else 0.0
            
            # Multi-agent / Communicating: Compute neighbor pressure enriched by messaging
            neighbor_pressure = self._compute_neighbor_pressure(tls_id)
            
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
        
        best_idx = np.argmax(phase_pressures)
        return int(best_idx)

    def _compute_neighbor_pressure(self, tls_id: str) -> float:
        """
        Gemiddelde genormaliseerde wachtrij-druk van naburige kruispunten.
        Uses CommunicationManager message registry to extract priority vehicles and incidents.
        """
        node = self.network.intersections.get(tls_id)
        if not node:
            return 0.0

        neighbor_ids = node.neighbor_ids
        if not neighbor_ids:
            return 0.0

        pressures = []
        for nid in neighbor_ids:
            # Query central registry
            status = self.network.comm_manager.query_central_registry(nid)
            ninfo = self.tls_info.get(nid)
            
            if not ninfo:
                continue

            # Default queue calculation
            if status and "queues" in status:
                total_q = sum(status["queues"].values())
            else:
                sub = traci.lane.getAllSubscriptionResults()
                total_q = sum(sub.get(lid, {}).get(VAR_HALTING_NUMBER, 0) for lid in ninfo["incoming"])

            n_lanes = max(len(ninfo["incoming"]), 1)
            raw_pressure = min(total_q / (n_lanes * MAX_QUEUE_PER_LANE), 1.0)

            # COMMUNICATING ADAPTATION:
            if status:
                # 1. If neighbor warns of emergency/priority vehicle, artificially increase pressure weight
                # to clear routes for emergency green waves
                if status.get("priority_vehicle", False):
                    raw_pressure = min(raw_pressure + 0.3, 1.0)
                
                # 2. Upstream incident: decrease pressure slightly or flag congestion
                if status.get("incident", False):
                    raw_pressure = min(raw_pressure + 0.15, 1.0)

            pressures.append(raw_pressure)

        return float(np.mean(pressures)) if pressures else 0.0

    # ── Beloningen ────────────────────────────────────────────────────────────

    def _compute_rewards(self) -> dict:
        """
        Reward per TLS:
          + diff_q (reductie in wachtrij t.o.v. vorige stap)
          + aangekomen voertuigen
          - huidige wachtrij & wachttijd
        """
        rewards    = {}
        sub        = traci.lane.getAllSubscriptionResults()

        for tls_id, info in self.tls_info.items():
            inc_lanes = info["incoming"]
            n_in = max(len(inc_lanes), 1)

            q_total    = sum(sub.get(lane, {}).get(VAR_HALTING_NUMBER, 0) for lane in inc_lanes)
            wait_total = sum(sub.get(lane, {}).get(VAR_WAITING_TIME,   0) for lane in inc_lanes)
            avg_speed  = np.mean([sub.get(lane, {}).get(VAR_MEAN_SPEED, 0) for lane in inc_lanes])
            
            q_norm     = q_total / n_in
            wait_norm  = wait_total / n_in

            prev_q = self.last_queues.get(tls_id, q_total)
            diff_q = prev_q - q_total
            self.last_queues[tls_id] = q_total

            reward = (
                  diff_q     *  2.5
                - q_norm     *  0.8
                - wait_norm  *  0.05
                + (avg_speed / MAX_SPEED) * 1.5
            )

            if info.get("just_switched", False):
                penalty = 3.0 if q_total < 2 else 1.0
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