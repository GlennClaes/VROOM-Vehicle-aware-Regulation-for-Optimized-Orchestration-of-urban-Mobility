"""
vroom_architecture.py - Unified Object-Oriented Domain Abstractions for VROOM
Consolidates training and live web simulation components into a single architecture.
"""

import os
import sys
import ctypes
import numpy as np
from typing import Dict, List, Any, Optional

# --- Compile C++ module dynamically ---
try:
    from rl.core.compile_cpp import compile_lib
except ImportError:
    try:
        from compile_cpp import compile_lib
    except ImportError:
        def compile_lib(): return False

# Trigger compilation on import
compile_lib()


# --- Traffic Prediction Engine (C++ Binding with Python Fallback) ---
class TrafficPredictionEngine:
    """Interfaces with C++ prediction library via ctypes or falls back to pure Python."""
    def __init__(self):
        self.lib = None
        self.engine_ptr = None
        
        # Pure Python fallback structures
        self._fallback_history: Dict[str, List[float]] = {}
        self._fallback_smoothed: Dict[str, float] = {}
        self._fallback_positions: Dict[str, tuple] = {}

        # Resolve paths
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if sys.platform == "win32":
            lib_path = os.path.join(current_dir, "prediction_engine.dll")
        else:
            lib_path = os.path.join(current_dir, "libprediction_engine.so")

        if os.path.exists(lib_path):
            try:
                self.lib = ctypes.CDLL(lib_path)
                
                # Define function signatures
                self.lib.create_engine.restype = ctypes.c_void_p
                self.lib.destroy_engine.argtypes = [ctypes.c_void_p]
                
                self.lib.record_flow.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_double]
                
                self.lib.predict_flow.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_double]
                self.lib.predict_flow.restype = ctypes.c_double
                
                self.lib.filter_vehicle_movement.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_double, ctypes.c_double, ctypes.c_double]
                self.lib.filter_vehicle_movement.restype = ctypes.c_bool

                self.lib.remove_vehicle_from_cache.argtypes = [ctypes.c_void_p, ctypes.c_char_p]

                self.lib.clear_history.argtypes = [ctypes.c_void_p]
                
                self.lib.compute_green_wave_offset.argtypes = [ctypes.c_double, ctypes.c_double]
                self.lib.compute_green_wave_offset.restype = ctypes.c_double
                
                self.lib.calculate_queue_spillback_probability.argtypes = [ctypes.c_double, ctypes.c_double]
                self.lib.calculate_queue_spillback_probability.restype = ctypes.c_double

                self.engine_ptr = self.lib.create_engine()
                print(f"[TrafficPredictionEngine] Successfully loaded C++ engine: {lib_path}")
            except Exception as e:
                print(f"[TrafficPredictionEngine] Failed to load C++ shared library: {e}. Using Python fallback.")
                self.lib = None
        else:
            print("[TrafficPredictionEngine] C++ shared library not found. Using Python fallback.")

    def record_flow(self, lane_id: str, count: float):
        """Records traffic counts for flow history."""
        if self.lib and self.engine_ptr:
            try:
                self.lib.record_flow(self.engine_ptr, lane_id.encode('utf-8'), float(count))
                return
            except:
                pass
        
        # Python fallback
        history = self._fallback_history.setdefault(lane_id, [])
        history.append(float(count))
        if len(history) > 100:
            history.pop(0)

    def predict_flow(self, lane_id: str, alpha: float = 0.2) -> float:
        """Predicts future traffic flow using Exponential Smoothing."""
        if self.lib and self.engine_ptr:
            try:
                return float(self.lib.predict_flow(self.engine_ptr, lane_id.encode('utf-8'), float(alpha)))
            except:
                pass

        # Python fallback
        history = self._fallback_history.get(lane_id, [])
        if not history:
            return 0.0
        
        current_val = history[-1]
        prev_smooth = self._fallback_smoothed.get(lane_id, current_val)
        new_smooth = alpha * current_val + (1.0 - alpha) * prev_smooth
        self._fallback_smoothed[lane_id] = new_smooth
        return new_smooth

    def compute_green_wave_offset(self, distance_meters: float, speed_limit_mps: float) -> float:
        """Calculates the optimal offset for a green wave along a corridor."""
        if self.lib:
            try:
                return float(self.lib.compute_green_wave_offset(float(distance_meters), float(speed_limit_mps)))
            except:
                pass

        # Python fallback
        if speed_limit_mps <= 0.1:
            return 0.0
        return round(distance_meters / speed_limit_mps)

    def calculate_queue_spillback_probability(self, current_queue: float, lane_capacity: float) -> float:
        """Calculates queue spillback probability using a sigmoidal curve."""
        if self.lib:
            try:
                return float(self.lib.calculate_queue_spillback_probability(float(current_queue), float(lane_capacity)))
            except:
                pass

        # Python fallback
        if lane_capacity <= 0.0:
            return 1.0
        ratio = current_queue / lane_capacity
        if ratio >= 1.0:
            return 1.0
        if ratio <= 0.0:
            return 0.0
        return 1.0 / (1.0 + np.exp(-10.0 * (ratio - 0.75)))

    def filter_vehicle_movement(self, vid: str, x: float, y: float, angle: float) -> bool:
        """Determines if a vehicle has moved significantly (thresholds: 0.1m or 1.0 degree)."""
        if self.lib and self.engine_ptr:
            try:
                return bool(self.lib.filter_vehicle_movement(self.engine_ptr, vid.encode('utf-8'), float(x), float(y), float(angle)))
            except:
                pass

        # Python fallback
        prev = self._fallback_positions.get(vid)
        if prev is None:
            self._fallback_positions[vid] = (float(x), float(y), float(angle))
            return True
        
        prev_x, prev_y, prev_angle = prev
        dx = float(x) - prev_x
        dy = float(y) - prev_y
        d_angle = abs(float(angle) - prev_angle)
        
        if (dx*dx + dy*dy) < 0.01 and d_angle < 1.0:
            return False
            
        self._fallback_positions[vid] = (float(x), float(y), float(angle))
        return True

    def remove_vehicle_from_cache(self, vid: str):
        """Removes a vehicle from the position cache."""
        if self.lib and self.engine_ptr:
            try:
                self.lib.remove_vehicle_from_cache(self.engine_ptr, vid.encode('utf-8'))
                return
            except:
                pass

        # Python fallback
        self._fallback_positions.pop(vid, None)

    def clear(self):
        """Clears flow, smoothing, and position history."""
        if self.lib and self.engine_ptr:
            try:
                self.lib.clear_history(self.engine_ptr)
            except:
                pass
        self._fallback_history.clear()
        self._fallback_smoothed.clear()
        self._fallback_positions.clear()

    def __del__(self):
        if self.lib and self.engine_ptr:
            try:
                self.lib.destroy_engine(self.engine_ptr)
            except:
                pass


# --- Communication Messages ---
class TrafficMessage:
    """Represents a message exchanged between intersections or via the central network."""
    def __init__(self, sender_id: str, message_type: str, data: Dict[str, Any]):
        self.sender_id = sender_id
        self.message_type = message_type  # e.g., 'queue_status', 'priority_alert', 'phase_info'
        self.data = data


# --- Communication Manager ---
class CommunicationManager:
    """Facilitates direct (P2P) and centralized message exchange between intersections."""
    def __init__(self):
        self.message_bus: Dict[str, List[TrafficMessage]] = {}
        self.central_registry: Dict[str, Dict[str, Any]] = {}

    def post_message(self, sender_id: str, receiver_id: str, message_type: str, data: Dict[str, Any]):
        """Direct P2P message delivery."""
        msg = TrafficMessage(sender_id, message_type, data)
        self.message_bus.setdefault(receiver_id, []).append(msg)

    def broadcast_status(self, sender_id: str, data: Dict[str, Any]):
        """Publish status to the central network registry."""
        self.central_registry[sender_id] = {
            "timestamp": data.get("timestamp", 0),
            "queues": data.get("queues", {}),
            "current_phase": data.get("current_phase", 0),
            "priority_vehicle": data.get("priority_vehicle", False),
            "incident": data.get("incident", False),
            "predicted_flow": data.get("predicted_flow", 0.0)
        }

    def get_messages(self, receiver_id: str) -> List[TrafficMessage]:
        """Fetch and clear P2P messages for an intersection."""
        messages = self.message_bus.get(receiver_id, [])
        self.message_bus[receiver_id] = []
        return messages

    def query_central_registry(self, query_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve status from the central registry."""
        return self.central_registry.get(query_id)


# --- Traffic Light Controller ---
class TrafficLight:
    """Wraps a SUMO traffic light system (TLS)."""
    def __init__(self, tls_id: str, green_phases: List[int], phase_to_lanes: Dict[int, List[str]]):
        self.id = tls_id
        self.green_phases = green_phases
        self.phase_to_lanes = phase_to_lanes
        
        self.current_phase_idx = 0
        self.yellow_active = False
        self.yellow_remaining = 0.0
        self.green_step_counter = 0.0
        self.step_counter = 0.0
        self.last_phase_idx: Optional[int] = None
        self.yellow_duration = 3.0
        self.min_green = 10.0
        self.max_green = 60.0

    def tick(self, delta_time: float = 1.0):
        """Advance internal timers."""
        if self.yellow_active:
            self.yellow_remaining -= delta_time
            if self.yellow_remaining <= 0:
                self.yellow_active = False
                self.green_step_counter = 0.0
        else:
            self.green_step_counter += delta_time
        
        self.step_counter += delta_time

    def set_phase(self, phase_idx: int, traci_conn, target_sumo_phase: int):
        """Apply a new phase and initiate a yellow transition if needed."""
        self.step_counter = 0.0
        self.last_phase_idx = self.current_phase_idx
        self.current_phase_idx = phase_idx

        # In SUMO, we trigger the intermediate yellow state
        try:
            current_sumo_phase = traci_conn.trafficlight.getPhase(self.id)
        except:
            current_sumo_phase = 0
        
        if target_sumo_phase != current_sumo_phase:
            try:
                logic = traci_conn.trafficlight.getAllProgramLogics(self.id)[0]
                yellow_phase = (current_sumo_phase + 1) % len(logic.phases)
                phase_state = logic.phases[yellow_phase].state.lower()
                
                if 'y' in phase_state or 'Y' in phase_state:
                    traci_conn.trafficlight.setPhase(self.id, yellow_phase)
                    traci_conn.trafficlight.setPhaseDuration(self.id, float(self.yellow_duration))
                    self.yellow_active = True
                    self.yellow_remaining = self.yellow_duration
                else:
                    traci_conn.trafficlight.setPhase(self.id, target_sumo_phase)
                    traci_conn.trafficlight.setPhaseDuration(self.id, 9999.0)
                    self.green_step_counter = 0.0
            except:
                self.green_step_counter = 0.0
        else:
            self.green_step_counter = 0.0


# --- Intersection ---
class Intersection:
    """Represents a physical junction with a TrafficLight and adaptive controllers."""
    def __init__(self, node_id: str, traffic_light: TrafficLight, incoming_lanes: List[str], outgoing_lanes: List[str]):
        self.id = node_id
        self.traffic_light = traffic_light
        self.incoming_lanes = incoming_lanes
        self.outgoing_lanes = outgoing_lanes
        self.neighbor_ids: List[str] = []
        
        self.last_observation: Optional[np.ndarray] = None
        self.is_starving = False
        self.has_priority_vehicle = False
        self.has_incident = False

    def update_sensor_data(self, traci_conn):
        """Scans the intersection area for priority vehicles (emergency/bus) and incidents."""
        self.has_priority_vehicle = False
        self.has_incident = False
        
        for lane in self.incoming_lanes:
            try:
                # Scan vehicles on this lane
                veh_ids = traci_conn.lane.getLastStepVehicleIDs(lane)
                for vid in veh_ids:
                    v_class = traci_conn.vehicle.getVehicleClass(vid)
                    # Check if emergency or public transit
                    if v_class in ["emergency", "bus"]:
                        self.has_priority_vehicle = True
                    
                    # Detect incidents based on extremely low speed and halted status
                    speed = traci_conn.vehicle.getSpeed(vid)
                    if speed < 0.1 and traci_conn.vehicle.getWaitingTime(vid) > 120.0:
                        self.has_incident = True
            except:
                pass


# --- Traffic Network ---
class TrafficNetwork:
    """Manages the network of intersections, nodes, and edges."""
    def __init__(self):
        self.intersections: Dict[str, Intersection] = {}
        self.comm_manager = CommunicationManager()
        self.prediction_engine = TrafficPredictionEngine()

    def add_intersection(self, intersection: Intersection):
        self.intersections[intersection.id] = intersection

    def build_neighborhood_graph(self):
        """Reconstruct neighborhood connections based on shared lanes."""
        lane_to_tls: Dict[str, List[str]] = {}
        for tls_id, node in self.intersections.items():
            for lane in node.incoming_lanes:
                lane_to_tls.setdefault(lane, []).append(tls_id)

        for tls_id, node in self.intersections.items():
            seen = set()
            node.neighbor_ids = []
            for lane in node.outgoing_lanes:
                for neighbor_id in lane_to_tls.get(lane, []):
                    if neighbor_id != tls_id and neighbor_id not in seen:
                        node.neighbor_ids.append(neighbor_id)
                        seen.add(neighbor_id)


# --- City ---
class City:
    """High-level abstraction for a city containing a TrafficNetwork."""
    def __init__(self, name: str):
        self.name = name
        self.network = TrafficNetwork()


# --- Traffic Analyzer ---
class TrafficAnalyzer:
    """Analyzes real-time density, congestion, and bottlenecks."""
    def __init__(self, network: TrafficNetwork):
        self.network = network

    def calculate_network_density(self, lane_subs: Dict[str, Dict[int, Any]]) -> Dict[str, float]:
        """Returns density per intersection (average vehicles per lane)."""
        densities = {}
        for node_id, node in self.network.intersections.items():
            vehicle_counts = []
            for lane in node.incoming_lanes:
                res = lane_subs.get(lane, {})
                # 0x10 is VAR_VEHICLE_NUMBER
                veh_count = res.get(0x10, 0)
                vehicle_counts.append(veh_count)
            densities[node_id] = float(np.mean(vehicle_counts)) if vehicle_counts else 0.0
        return densities


# --- Metrics Collector ---
class MetricsCollector:
    """Aggregates multi-dimensional performance metrics/KPIs."""
    def __init__(self):
        self.cum_throughput = 0
        self.cum_tawt = 0.0
        self.cum_ttt = 0.0
        self.cum_tnr = 0.0
        
        self.last_metrics = {
            'intersection_delay': 0.0,
            'pressure': 0,
            'ttt': 0.0,
            'nql': 0.0,
            'fairness': 1.0,
            'tp_delay_ratio': 0.0,
            'tawt': 0.0,
            'ewpc': 0.0,
            'aql': 0.0,
            'tnr': 0.0,
        }

    def update_metrics(self, traci_conn, active_vehicles: Dict[str, Dict[str, Any]], arrived_ids: List[str], lane_subs: Dict[str, Dict[int, Any]], network: TrafficNetwork):
        """Computes system-wide KPIs using lane subscriptions and active vehicles."""
        # 1. Update cumulative arrived vehicle stats
        self.cum_throughput += len(arrived_ids)

        for veh_id in arrived_ids:
            try:
                # Add final stats of departed vehicles if cached
                if veh_id in active_vehicles:
                    v = active_vehicles[veh_id]
                    self.cum_tawt += v.get('waiting_time', 0.0)
                    dep_time = v.get('departure', 0.0)
                    curr_time = traci_conn.simulation.getTime()
                    self.cum_ttt += (curr_time - dep_time)
                    
                    q_penalty = 1.0 if v.get('speed', 0.0) < 0.1 else 0.0
                    self.cum_tnr -= (q_penalty + v.get('waiting_time', 0.0) + v.get('time_loss', 0.0))
            except:
                pass

        # 2. Sum current active vehicle metrics
        curr_active_tawt = 0.0
        curr_active_ttt = 0.0
        curr_active_tnr_penalty = 0.0
        try:
            curr_time = traci_conn.simulation.getTime()
        except:
            curr_time = 0.0

        for v in active_vehicles.values():
            w = v.get('waiting_time', 0.0)
            l = v.get('time_loss', 0.0)
            s = v.get('speed', 0.0)
            d = v.get('departure', 0.0)
            
            curr_active_tawt += w
            curr_active_ttt += (curr_time - d)
            curr_active_tnr_penalty -= ((1.0 if s < 0.1 else 0.0) + w + l)

        tawt = self.cum_tawt + curr_active_tawt
        ttt = self.cum_ttt + curr_active_ttt
        tnr = self.cum_tnr + curr_active_tnr_penalty

        # 3. Calculate queue-based metrics
        total_in_lanes = 0
        pressure = 0
        halting_sum = 0
        nql_sum = 0.0
        wait_times = []

        for node in network.intersections.values():
            for l in node.incoming_lanes:
                res = lane_subs.get(l, {})
                # 0x10: vehicle number, 0x14: halting number, 0x7a: waiting time
                veh_num = res.get(0x10, 0)
                halt_num = res.get(0x14, 0)
                wait_t = res.get(0x7a, 0.0)
                
                pressure += veh_num
                halting_sum += halt_num
                wait_times.append(wait_t)
                
                # Approximate lane length (default 100m if exception)
                lane_len = 100.0
                try: lane_len = traci_conn.lane.getLength(l)
                except: pass
                nql_sum += (halt_num / (max(lane_len, 1.0) / 5.0))
                total_in_lanes += 1
            
            for l in node.outgoing_lanes:
                res = lane_subs.get(l, {})
                pressure -= res.get(0x10, 0)

        avg_nql = nql_sum / total_in_lanes if total_in_lanes > 0 else 0.0
        aql = halting_sum / total_in_lanes if total_in_lanes > 0 else 0.0

        # 4. Jain's Fairness Index
        if wait_times and sum(wait_times) > 0:
            sum_w = sum(wait_times)
            sum_sq_w = sum(w**2 for w in wait_times)
            fairness = (sum_w**2) / (len(wait_times) * sum_sq_w)
        else:
            fairness = 1.0

        total_delay = sum(v.get('time_loss', 0.0) for v in active_vehicles.values())
        tp_delay_ratio = self.cum_throughput / (total_delay / 100.0 + 1e-6)
        total_ever_entered = self.cum_throughput + len(active_vehicles)
        ewpc = tawt / total_ever_entered if total_ever_entered > 0 else 0.0

        self.last_metrics = {
            'intersection_delay': round(total_delay, 2),
            'pressure': int(pressure),
            'ttt': round(ttt, 2),
            'nql': round(avg_nql, 4),
            'fairness': round(fairness, 3),
            'tp_delay_ratio': round(tp_delay_ratio, 4),
            'tawt': round(tawt, 1),
            'ewpc': round(ewpc, 1),
            'aql': round(aql, 2),
            'tnr': round(tnr, 2),
        }

    def get_snapshot(self) -> Dict[str, Any]:
        return self.last_metrics
