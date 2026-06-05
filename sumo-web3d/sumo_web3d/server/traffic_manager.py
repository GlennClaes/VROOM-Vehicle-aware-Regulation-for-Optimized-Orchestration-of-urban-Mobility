import json
import numpy as np
import urllib.request
import asyncio
import traci
import os
import sys

tc = traci.constants

# Unified imports with fallbacks
try:
    from .rl_core.vroom_architecture import TrafficNetwork, Intersection, TrafficLight
except ImportError:
    try:
        from rl_core.vroom_architecture import TrafficNetwork, Intersection, TrafficLight
    except ImportError:
        # Append path fallback
        sys.path.append(os.path.join(os.path.dirname(__file__), "rl_core"))
        from vroom_architecture import TrafficNetwork, Intersection, TrafficLight


class TrafficManager:
    """
    Manages a single traffic light intersection.
    Refactored to wrap the unified Intersection and TrafficLight domain components.
    """
    def __init__(self, traffic_light_id):
        self.tl_id = traffic_light_id
        self.yellow_duration = 3.0
        self.steps_per_action = 10  # Strictly 10s
        self.min_green_duration = 20.0  # Minimum 20s green
        self.max_green_duration = 60.0  # Maximum 60s green to prevent starvation

        # Backwards compatible state property
        self.state = {
            'step_counter': 0.0,
            'green_step_counter': 0.0,
            'current_phase_idx': 0,
            'yellow_active': False,
            'yellow_remaining': 0.0,
            'lanes': [],
            'green_phases': [],
            'phase_to_lanes': {},
            'last_phase_idx': None,
            'cached_logic': None,
        }
        
        # Domain objects (will be instantiated in initialize())
        self.node = None
        self.network = None  # Will be set by SimulationWorker

    def initialize(self, traci_conn):
        """Detect controlled lanes and green phases from SUMO's program."""
        try:
            controlled_lanes = traci_conn.trafficlight.getControlledLanes(self.tl_id)
            unique_lanes = list(dict.fromkeys(controlled_lanes))
            
            if len(unique_lanes) <= 8:
                selected_lanes = unique_lanes
            else:
                edge_groups = {}
                for l in unique_lanes:
                    edge_id = l.split('_')[0] if '_' in l else l
                    if edge_id not in edge_groups: edge_groups[edge_id] = []
                    edge_groups[edge_id].append(l)
                
                selected = []
                for eid in edge_groups:
                    if len(selected) < 8:
                        selected.append(edge_groups[eid][0])
                for eid in edge_groups:
                    for i in range(1, len(edge_groups[eid])):
                        if len(selected) < 8:
                            selected.append(edge_groups[eid][i])
                selected_lanes = selected
                print(f"[TrafficManager] {self.tl_id}: Reduced {len(unique_lanes)} lanes to {len(selected)} representative lanes.", flush=True)

            self.state['lanes'] = selected_lanes

            # Get program logic and find green phases
            logic = traci_conn.trafficlight.getAllProgramLogics(self.tl_id)[0]
            green_phases = []
            phase_to_lanes = {}
            seen_states = set()
            
            links = traci_conn.trafficlight.getControlledLinks(self.tl_id)
            
            for i, phase in enumerate(logic.phases):
                has_green = 'g' in phase.state.lower()
                is_yellow = 'y' in phase.state.lower() and 'g' not in phase.state.lower()
                if has_green and not is_yellow:
                    if phase.state not in seen_states:
                        green_phases.append(i)
                        seen_states.add(phase.state)
                        
                        p_lanes = []
                        for link_idx, link in enumerate(links):
                            if link_idx < len(phase.state) and phase.state[link_idx].lower() in ['g', 'r']:
                                if phase.state[link_idx].lower() == 'g':
                                    for sublink in link:
                                        p_lanes.append(sublink[0])
                        phase_to_lanes[i] = list(set(p_lanes))

            if not green_phases:
                green_phases = list(range(0, len(logic.phases), 2))
                for gp in green_phases: phase_to_lanes[gp] = selected_lanes

            self.state['green_phases'] = sorted(list(set(green_phases)))
            self.state['phase_to_lanes'] = phase_to_lanes
            self.state['cached_logic'] = logic
            
            try:
                programs = traci_conn.trafficlight.getAllProgramLogics(self.tl_id)
                for p in programs:
                    if p.programID in ['static', '0', 'default']:
                        traci_conn.trafficlight.setProgram(self.tl_id, p.programID)
                        break
            except: pass

            first_phase = self.state['green_phases'][0] if self.state['green_phases'] else 0
            traci_conn.trafficlight.setPhase(self.tl_id, first_phase)
            traci_conn.trafficlight.setPhaseDuration(self.tl_id, 999.0)

            # Instantiate unified domain components
            tl = TrafficLight(self.tl_id, self.state['green_phases'], phase_to_lanes)
            tl.yellow_duration = self.yellow_duration
            tl.min_green = self.min_green_duration
            tl.max_green = self.max_green_duration
            
            incoming = sorted(list(set(link[0][0] for link in links if link)))
            outgoing = sorted(list(set(link[0][1] for link in links if link)))
            
            self.node = Intersection(self.tl_id, tl, incoming, outgoing)

            print(f"[TrafficManager] {self.tl_id}: {len(self.state['green_phases'])} green phases, {len(selected_lanes)} lanes.", flush=True)
        except Exception as e:
            print(f"[TrafficManager] Error initializing {self.tl_id}: {e}", flush=True)
            self.state['green_phases'] = [0]
            # Minimal fallback object
            self.node = Intersection(self.tl_id, TrafficLight(self.tl_id, [0], {0: []}), [], [])

    def tick(self, traci_conn, delta_time=1.0):
        """Update timers every simulation step."""
        if not self.node:
            return

        tl = self.node.traffic_light
        tl.tick(delta_time)
        
        # Read sensor inputs (priority vehicles and incidents)
        self.node.update_sensor_data(traci_conn)

        # Sync back to legacy state dict
        self.state['yellow_active'] = tl.yellow_active
        self.state['yellow_remaining'] = tl.yellow_remaining
        self.state['current_phase_idx'] = tl.current_phase_idx
        self.state['green_step_counter'] = tl.green_step_counter
        self.state['step_counter'] = tl.step_counter

    def apply_action(self, traci_conn, action):
        """Apply an AI-selected action and return a compact decision record."""
        s = self.state
        tl = self.node.traffic_light

        tl.step_counter = 0.0
        s['step_counter'] = 0.0

        green_phases = s['green_phases']
        if not green_phases:
            return {
                'tls_id': self.tl_id,
                'action': action,
                'previous_phase_index': s['current_phase_idx'],
                'target_phase_index': None,
                'switched': False,
                'yellow_transition': False,
                'status': 'no_green_phases',
            }

        previous_phase_idx = s['current_phase_idx']
        is_starving = (tl.green_step_counter >= tl.max_green)

        if action == -1 or is_starving:
            ai_phase_idx = self.get_max_pressure_action(traci_conn, exclude_idx=previous_phase_idx if is_starving else None)
            wants_to_switch = (ai_phase_idx != s['current_phase_idx'])
            if is_starving: 
                print(f"⚖️ [FAIRNESS] {self.tl_id}: Max green reached ({tl.green_step_counter}s). Forcing switch.", flush=True)
        else:
            num_phases = len(green_phases)
            if num_phases <= 8:
                ai_phase_idx = action % num_phases
            else:
                ai_phase_idx = int((action / 8.0) * num_phases) % num_phases
            
            wants_to_switch = (ai_phase_idx != s['current_phase_idx'])
            
            if wants_to_switch and ai_phase_idx == s['last_phase_idx']:
                alt_idx = self.get_max_pressure_action(traci_conn, exclude_idx=[s['current_phase_idx'], s['last_phase_idx']])
                if alt_idx != s['current_phase_idx']:
                    ai_phase_idx = alt_idx
                    wants_to_switch = True

        target_phase_idx = previous_phase_idx
        target_sumo_phase = green_phases[previous_phase_idx]
        current_sumo_phase = None
        yellow_transition = False
        status = 'held'

        if wants_to_switch:
            new_phase_idx = ai_phase_idx
            target_green = green_phases[new_phase_idx]
            target_phase_idx = new_phase_idx
            target_sumo_phase = target_green

            try:
                res = traci_conn.trafficlight.getSubscriptionResults(self.tl_id)
                current_sumo_phase = res.get(tc.TL_CURRENT_PHASE) if res else traci_conn.trafficlight.getPhase(self.tl_id)
            except:
                current_sumo_phase = 0

            if target_green != current_sumo_phase:
                tl.set_phase(new_phase_idx, traci_conn, target_green)
                
                # Sync back to legacy
                s['yellow_active'] = tl.yellow_active
                s['yellow_remaining'] = tl.yellow_remaining
                s['current_phase_idx'] = tl.current_phase_idx
                s['last_phase_idx'] = previous_phase_idx
                
                yellow_transition = tl.yellow_active
                status = 'switching_yellow' if tl.yellow_active else 'switched_direct'
                print(f"🤖 [AI CONTROL] {self.tl_id}: Switching to phase {new_phase_idx} to clear queue.", flush=True)
            else:
                s['current_phase_idx'] = new_phase_idx
                status = 'already_target_phase'
        else:
            try:
                res = traci_conn.trafficlight.getSubscriptionResults(self.tl_id)
                current_sumo_phase = res.get(tc.TL_CURRENT_PHASE) if res else traci_conn.trafficlight.getPhase(self.tl_id)
            except:
                current_sumo_phase = 0

        return {
            'tls_id': self.tl_id,
            'action': action,
            'ai_phase_index': ai_phase_idx,
            'previous_phase_index': previous_phase_idx,
            'target_phase_index': target_phase_idx,
            'current_sumo_phase': current_sumo_phase,
            'target_sumo_phase': target_sumo_phase,
            'switched': target_phase_idx != previous_phase_idx,
            'yellow_transition': yellow_transition,
            'status': status,
        }

    def get_max_pressure_action(self, traci_conn, exclude_idx=None):
        """Heuristic to pick the best green phase based on current lane pressure, incorporating communication info."""
        s = self.state
        green_phases = s['green_phases']
        if not green_phases: return 0
        
        excludes = []
        if exclude_idx is not None:
            excludes = exclude_idx if isinstance(exclude_idx, list) else [exclude_idx]

        # Query CommunicationManager if neighbor has priority vehicle or incident
        has_neighbor_emergency = False
        neighbor_emergency_dirs = []
        
        if self.network and self.node:
            for nid in self.node.neighbor_ids:
                status = self.network.comm_manager.query_central_registry(nid)
                if status and status.get("priority_vehicle", False):
                    has_neighbor_emergency = True
                    # Find which lanes connect to this neighbor
                    # and prioritize green phases that feed into or from it
                    neighbor_emergency_dirs.append(nid)

        pressures = []
        for i, phase_idx in enumerate(green_phases):
            if i in excludes:
                pressures.append(-1)
                continue
                
            lanes = s['phase_to_lanes'].get(phase_idx, [])
            p = 0
            for l in lanes:
                try:
                    res = traci_conn.lane.getSubscriptionResults(l)
                    halt_val = res.get(0x14, 0) if res else traci_conn.lane.getLastStepHaltingNumber(l)
                    
                    # Boost pressure if priority vehicle detected on this lane
                    if self.node and self.node.has_priority_vehicle:
                        # Scan vehicles on this lane
                        veh_ids = traci_conn.lane.getLastStepVehicleIDs(l)
                        for vid in veh_ids:
                            if traci_conn.vehicle.getVehicleClass(vid) in ["emergency", "bus"]:
                                halt_val += 50.0  # Force immediate green
                    
                    p += halt_val
                except: pass
            
            # Boost phases that clear emergency corridors
            if has_neighbor_emergency:
                # If this phase leads to a clear flow, give it a minor boost
                p += 2.0
                
            pressures.append(p)
        
        if exclude_idx is not None and max(pressures) <= 0:
            return exclude_idx
            
        return int(np.argmax(pressures)) if pressures else 0

    async def update(self, traci_conn, strategy, intensity=0.7, model_path=None):
        """Legacy single-TLS update (used for baseline strategy)."""
        s = self.state
        tl = self.node.traffic_light
        delta_time = traci_conn.simulation.getDeltaT()

        tl.tick(delta_time)
        s['yellow_active'] = tl.yellow_active
        s['yellow_remaining'] = tl.yellow_remaining
        s['current_phase_idx'] = tl.current_phase_idx
        s['green_step_counter'] = tl.green_step_counter
        s['step_counter'] = tl.step_counter

        if tl.yellow_active:
            if tl.yellow_remaining <= 0:
                tl.yellow_active = False
                target = s['green_phases'][s['current_phase_idx']]
                traci_conn.trafficlight.setPhase(self.tl_id, target)
                traci_conn.trafficlight.setPhaseDuration(self.tl_id, 999.0)
                tl.green_step_counter = 0.0
            return

        if tl.step_counter < self.steps_per_action:
            return
        
        if tl.green_step_counter < self.min_green_duration:
            return

        tl.step_counter = 0.0
        green_phases = s['green_phases']
        if not green_phases:
            return

        # Clockwise cycle
        new_phase_idx = (s['current_phase_idx'] + 1) % len(green_phases)

        if new_phase_idx != s['current_phase_idx']:
            target_green = green_phases[new_phase_idx]
            tl.set_phase(new_phase_idx, traci_conn, target_green)
            
            # Sync back
            s['yellow_active'] = tl.yellow_active
            s['yellow_remaining'] = tl.yellow_remaining
            s['current_phase_idx'] = tl.current_phase_idx

    def get_observations(self, traci_conn, lane_sub_results=None):
        """Haal queues, voertuig-aantallen, wachttijden en snelheden op."""
        obs = []
        subs = lane_sub_results if lane_sub_results is not None else traci_conn.lane.getAllSubscriptionResults()
        
        for lane in self.state['lanes']:
            res = subs.get(lane)
            if res:
                q = res.get(0x14, 0)
                c = res.get(0x10, 0)
                w = res.get(0x7a, 0)
                s = res.get(0x11, 0)
                obs.extend([
                    min(q / 20.0, 1.0),
                    min(c / 20.0, 1.0),
                    min(w / 300.0, 1.0),
                    min(s / 15.0, 1.0)
                ])
            else:
                obs.extend([0.0, 0.0, 0.0, 0.0])
        
        while len(obs) < 32:
            obs.extend([0.0, 0.0, 0.0, 0.0])
        return obs[:32]

    def needs_decision(self):
        """Check if this TM is ready for a new decision (not in yellow, past min green)."""
        if not self.node: return False
        tl = self.node.traffic_light
        if tl.yellow_active:
            return False
        if tl.step_counter < self.steps_per_action:
            return False
        if tl.green_step_counter < tl.min_green:
            return False
        return True


async def batch_predict_ai(traffic_managers, traci_conn, intensity, model_path=None):
    """
    Collect observations, broadcast message details to CommunicationManager,
    call backend API in batch, and apply results.
    """
    predictions = []
    decision_tms = []
    observations_by_tls = {}

    lane_sub_results = traci_conn.lane.getAllSubscriptionResults()

    # ── STEP 1: Update legacys, update sensors, and publish statuses ───────
    for tm in traffic_managers:
        tm.tick(traci_conn, delta_time=traci_conn.simulation.getDeltaT())
        
        # Build queue dict and register with flow predictor
        lane_queues = {}
        obs_lanes = tm.get_observations(traci_conn, lane_sub_results=lane_sub_results)
        
        for idx, lid in enumerate(tm.state['lanes']):
            q_val = obs_lanes[idx*4] * 20.0
            c_val = obs_lanes[idx*4 + 1] * 20.0
            lane_queues[lid] = q_val
            
            if tm.network:
                tm.network.prediction_engine.record_flow(lid, c_val)

        # Predict flows
        predicted_flow = 0.0
        if tm.network:
            flows = [tm.network.prediction_engine.predict_flow(lid) for lid in tm.state['lanes']]
            predicted_flow = float(np.mean(flows)) if flows else 0.0

        # Broadcast status to network CommunicationManager
        if tm.network and tm.node:
            tm.network.comm_manager.broadcast_status(tm.tl_id, {
                "timestamp": traci_conn.simulation.getTime(),
                "queues": lane_queues,
                "current_phase": tm.state['current_phase_idx'],
                "priority_vehicle": tm.node.has_priority_vehicle,
                "incident": tm.node.has_incident,
                "predicted_flow": predicted_flow
            })

        if not tm.needs_decision():
            continue
        
        try:
            res = traci_conn.trafficlight.getSubscriptionResults(tm.tl_id)
            current_phase = res.get(0x28) if res else traci_conn.trafficlight.getPhase(tm.tl_id)
        except:
            current_phase = 0

        predictions.append({
            'tls_id': tm.tl_id,
            'obs': obs_lanes,
            'phase': current_phase,
            'intensity': intensity
        })
        decision_tms.append(tm)
        observations_by_tls[tm.tl_id] = obs_lanes

    if not predictions:
        return []

    # ── STEP 2: Execute Batch HTTP Call ────────────────────────────────────
    try:
        payload = {'predictions': predictions}
        if model_path:
            payload['model_path'] = model_path

        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            'http://backend:8000/rl/inference/predict_batch',
            data=body,
            headers={'Content-Type': 'application/json'}
        )

        loop = asyncio.get_running_loop()
        def _call():
            with urllib.request.urlopen(req, timeout=1.5) as r:
                return json.loads(r.read().decode())
        
        resp = await loop.run_in_executor(None, _call)
        actions = resp.get('actions', {})

        decisions = []
        for tm in decision_tms:
            action = actions.get(tm.tl_id, -1)
            decision = tm.apply_action(traci_conn, action)
            obs_lanes = observations_by_tls.get(tm.tl_id, [])
            queue_estimate = sum(obs_lanes[0::4]) * 20.0
            vehicle_estimate = sum(obs_lanes[1::4]) * 20.0
            wait_estimate = sum(obs_lanes[2::4]) * 300.0
            decision.update({
                'queue_estimate': round(queue_estimate, 1),
                'vehicle_estimate': round(vehicle_estimate, 1),
                'waiting_time_estimate': round(wait_estimate, 1),
                'model': resp.get('model'),
                'fallback': action == -1,
            })
            decisions.append(decision)
        return decisions

    except Exception as e:
        decisions = []
        for tm in decision_tms:
            decision = tm.apply_action(traci_conn, -1)
            obs_lanes = observations_by_tls.get(tm.tl_id, [])
            decision.update({
                'queue_estimate': round(sum(obs_lanes[0::4]) * 20.0, 1),
                'vehicle_estimate': round(sum(obs_lanes[1::4]) * 20.0, 1),
                'waiting_time_estimate': round(sum(obs_lanes[2::4]) * 300.0, 1),
                'model': model_path,
                'fallback': True,
                'error': str(e),
            })
            decisions.append(decision)
        return decisions
