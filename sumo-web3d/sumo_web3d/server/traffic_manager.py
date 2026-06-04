import json
import numpy as np
import urllib.request
import asyncio
import traci
tc = traci.constants


class TrafficManager:
    """
    Manages a single traffic light intersection.
    For baseline: simple fixed-time cycling (clockwise phase order).
    For SAM: calls the RL backend API for AI decisions.
    
    Phase cycling is always sequential (clockwise) — the AI controls
    WHICH phase to switch to, but transitions always go through yellow.
    """
    def __init__(self, traffic_light_id):
        self.tl_id = traffic_light_id
        self.yellow_duration = 4
        self.steps_per_action = 10  # Strictly 10s
        self.min_green_duration = 10  # Minimum 10s green
        self.max_green_duration = 60  # Maximum 60s green to prevent starvation

        self.state = {
            'step_counter': 0, # Start at 0 for predictable baseline
            'green_step_counter': 0,
            'current_phase_idx': 0,
            'yellow_active': False,
            'yellow_remaining': 0,
            'lanes': [],
            'green_phases': [],
            'phase_to_lanes': {}, # Map phase index to list of controlled lanes
            'last_phase_idx': None, # To prevent immediate repeats
            'cached_logic': None, # Store logic to avoid heavy TraCI calls
        }

    def initialize(self, traci_conn):
        """Detect controlled lanes and green phases from SUMO's program."""
        try:
            # Get unique controlled lanes, but group them by edge to ensure spatial coverage
            # We want to pick at most 8 lanes that represent ALL incoming directions
            controlled_lanes = traci_conn.trafficlight.getControlledLanes(self.tl_id)
            unique_lanes = list(dict.fromkeys(controlled_lanes))
            
            if len(unique_lanes) <= 8:
                self.state['lanes'] = unique_lanes
            else:
                # Group by edge (lane ID is usually edgeID_index)
                edge_groups = {}
                for l in unique_lanes:
                    edge_id = l.split('_')[0] if '_' in l else l
                    if edge_id not in edge_groups: edge_groups[edge_id] = []
                    edge_groups[edge_id].append(l)
                
                # Pick 1-2 lanes from each edge until we have 8
                selected = []
                # First pass: one from each edge
                for eid in edge_groups:
                    if len(selected) < 8:
                        selected.append(edge_groups[eid][0])
                # Second pass: fill up with remaining lanes
                for eid in edge_groups:
                    for i in range(1, len(edge_groups[eid])):
                        if len(selected) < 8:
                            selected.append(edge_groups[eid][i])
                
                self.state['lanes'] = selected
                print(f"[TrafficManager] {self.tl_id}: Reduced {len(unique_lanes)} lanes to {len(selected)} representative lanes.", flush=True)

            # Get the program logic and find green phases
            logic = traci_conn.trafficlight.getAllProgramLogics(self.tl_id)[0]
            green_phases = []
            phase_to_lanes = {}
            seen_states = set()
            
            # Map lanes to their link index in the phase state string
            links = traci_conn.trafficlight.getControlledLinks(self.tl_id)
            
            for i, phase in enumerate(logic.phases):
                has_green = 'g' in phase.state.lower()
                is_yellow = 'y' in phase.state.lower() and 'g' not in phase.state.lower()
                if has_green and not is_yellow:
                    if phase.state not in seen_states:
                        green_phases.append(i)
                        seen_states.add(phase.state)
                        
                        # Identify lanes that are green in this phase
                        p_lanes = []
                        for link_idx, link in enumerate(links):
                            if link_idx < len(phase.state) and phase.state[link_idx].lower() in ['g', 'r']: # 'r' for right turn usually
                                if phase.state[link_idx].lower() == 'g':
                                    for sublink in link:
                                        p_lanes.append(sublink[0])
                        phase_to_lanes[i] = list(set(p_lanes))

            if not green_phases:
                green_phases = list(range(0, len(logic.phases), 2))
                for gp in green_phases: phase_to_lanes[gp] = self.state['lanes']

            self.state['green_phases'] = sorted(list(set(green_phases)))
            self.state['phase_to_lanes'] = phase_to_lanes
            self.state['cached_logic'] = logic
            
            # Switch to 'static' program to prevent SUMO's actuated logic from interfering
            try:
                programs = traci_conn.trafficlight.getAllProgramLogics(self.tl_id)
                for p in programs:
                    if p.programID in ['static', '0', 'default']:
                        traci_conn.trafficlight.setProgram(self.tl_id, p.programID)
                        break
            except: pass

            # Initialize to the first green phase and freeze timer
            first_phase = self.state['green_phases'][0] if self.state['green_phases'] else 0
            traci_conn.trafficlight.setPhase(self.tl_id, first_phase)
            traci_conn.trafficlight.setPhaseDuration(self.tl_id, 999.0)
            
            # Print for debug
            print(f"[TrafficManager] {self.tl_id}: {len(self.state['green_phases'])} green phases detected: {self.state['green_phases']}", flush=True)
            num_lanes = len(self.state['lanes'])
            print(f"[TrafficManager] {self.tl_id}: {num_lanes} lanes detected.", flush=True)
        except Exception as e:
            print(f"[TrafficManager] Error initializing {self.tl_id}: {e}", flush=True)
            self.state['green_phases'] = [0]

    def tick(self, traci_conn, delta_time=1.0):
        """Update timers every simulation step."""
        s = self.state

        # Handle yellow phase countdown
        if s['yellow_active']:
            s['yellow_remaining'] -= delta_time
            if s['yellow_remaining'] <= 0:
                s['yellow_active'] = False
                target = s['green_phases'][s['current_phase_idx']]
                traci_conn.trafficlight.setPhase(self.tl_id, target)
                traci_conn.trafficlight.setPhaseDuration(self.tl_id, 999.0)
                s['green_step_counter'] = 0
            return

        # Increment green timer
        s['green_step_counter'] += delta_time
        s['step_counter'] += delta_time

    def apply_action(self, traci_conn, action):
        """Apply an AI-selected action and return a compact decision record."""
        s = self.state

        # Reset the decision interval counter
        s['step_counter'] = 0

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

        # Check for starvation: if current phase has been green too long, force a switch
        is_starving = (s['green_step_counter'] >= self.max_green_duration)
        
        if action == -1 or is_starving:
            # Local fallback: Max Pressure, but exclude current phase if starving
            ai_phase_idx = self.get_max_pressure_action(traci_conn, exclude_idx=previous_phase_idx if is_starving else None)
            wants_to_switch = (ai_phase_idx != s['current_phase_idx'])
            if is_starving: 
                print(f"⚖️ [FAIRNESS] {self.tl_id}: Max green reached ({s['green_step_counter']}s). Forcing switch.", flush=True)
        else:
            # Smart mapping: if we have more than 8 phases, spread the 8 AI actions across them
            num_phases = len(green_phases)
            if num_phases <= 8:
                ai_phase_idx = action % num_phases
            else:
                # Map 0..7 to 0..num_phases-1
                ai_phase_idx = int((action / 8.0) * num_phases) % num_phases
            
            wants_to_switch = (ai_phase_idx != s['current_phase_idx'])
            
            # ANTI-REPEAT: Don't allow switching back to the phase we JUST left if others are waiting
            if wants_to_switch and ai_phase_idx == s['last_phase_idx']:
                # Re-calculate best phase excluding BOTH current and last
                alt_idx = self.get_max_pressure_action(traci_conn, exclude_idx=[s['current_phase_idx'], s['last_phase_idx']])
                if alt_idx != s['current_phase_idx']:
                    ai_phase_idx = alt_idx
                    wants_to_switch = True
                    # print(f"🚫 [COOLDOWN] {self.tl_id}: Preventing immediate repeat of phase {s['last_phase_idx']}", flush=True)

        target_phase_idx = previous_phase_idx
        target_sumo_phase = green_phases[previous_phase_idx]
        current_sumo_phase = None
        yellow_transition = False
        status = 'held'

        # Apply phase change with yellow transition
        if wants_to_switch:
            # AI NOW HAS FULL CONTROL: Pick the specific phase requested
            new_phase_idx = ai_phase_idx
            
            res = traci_conn.trafficlight.getSubscriptionResults(self.tl_id)
            current_sumo_phase = res.get(tc.TL_CURRENT_PHASE) if res else traci_conn.trafficlight.getPhase(self.tl_id)
            target_green = green_phases[new_phase_idx]
            target_phase_idx = new_phase_idx
            target_sumo_phase = target_green

            if target_green != current_sumo_phase:
                logic = s['cached_logic']
                # Try to find a yellow transition phase
                # We look at the next phase after current; if it leads to target, use it.
                # In SUMO, usually current+1 is yellow.
                yellow_phase = (current_sumo_phase + 1) % len(logic.phases)
                
                # Check if it's actually a yellow phase
                phase_state = logic.phases[yellow_phase].state.lower()
                if 'y' not in phase_state:
                    # If not yellow, just jump to green (failsafe)
                    traci_conn.trafficlight.setPhase(self.tl_id, target_green)
                    traci_conn.trafficlight.setPhaseDuration(self.tl_id, 9999)
                    s['current_phase_idx'] = new_phase_idx
                    status = 'switched_direct'
                else:
                    traci_conn.trafficlight.setPhase(self.tl_id, yellow_phase)
                    traci_conn.trafficlight.setPhaseDuration(self.tl_id, 3.0) # Match training YELLOW_DURATION
                    s['yellow_active'] = True
                    s['yellow_remaining'] = 3.0
                    s['last_phase_idx'] = previous_phase_idx # Store for cooldown
                    s['current_phase_idx'] = new_phase_idx
                    yellow_transition = True
                    status = 'switching_yellow'
                print(f"🤖 [AI CONTROL] {self.tl_id}: Switching to phase {new_phase_idx} to clear queue.", flush=True)
            else:
                s['current_phase_idx'] = new_phase_idx
                status = 'already_target_phase'
        else:
            res = traci_conn.trafficlight.getSubscriptionResults(self.tl_id)
            current_sumo_phase = res.get(tc.TL_CURRENT_PHASE) if res else traci_conn.trafficlight.getPhase(self.tl_id)

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
        """Heuristic to pick the best green phase based on current lane pressure."""
        s = self.state
        green_phases = s['green_phases']
        if not green_phases: return 0
        
        # Normalize exclude_idx to a list
        excludes = []
        if exclude_idx is not None:
            excludes = exclude_idx if isinstance(exclude_idx, list) else [exclude_idx]

        pressures = []
        for i, phase_idx in enumerate(green_phases):
            if i in excludes:
                pressures.append(-1) # Very low priority
                continue
                
            lanes = s['phase_to_lanes'].get(phase_idx, [])
            p = 0
            for l in lanes:
                try:
                    res = traci_conn.lane.getSubscriptionResults(l)
                    p += res.get(0x14, 0) if res else traci_conn.lane.getLastStepHaltingNumber(l)
                except: pass
            pressures.append(p)
        
        # If all others are empty, just stay put unless we are forced
        if exclude_idx is not None and max(pressures) <= 0:
            return exclude_idx # Stay green if no one else is waiting
            
        return int(np.argmax(pressures)) if pressures else 0

    async def update(self, traci_conn, strategy, intensity=0.7, model_path=None):
        """Legacy single-TLS update (used for baseline strategy)."""
        s = self.state
        delta_time = traci_conn.simulation.getDeltaT()

        # Handle yellow phase countdown
        if s['yellow_active']:
            s['yellow_remaining'] -= delta_time
            if s['yellow_remaining'] <= 0:
                s['yellow_active'] = False
                target = s['green_phases'][s['current_phase_idx']]
                traci_conn.trafficlight.setPhase(self.tl_id, target)
                traci_conn.trafficlight.setPhaseDuration(self.tl_id, 999.0)
                s['green_step_counter'] = 0
            return

        s['green_step_counter'] += delta_time
        s['step_counter'] += delta_time
        if s['step_counter'] < self.steps_per_action:
            return
        
        if s['green_step_counter'] < self.min_green_duration:
            return

        s['step_counter'] = 0
        green_phases = s['green_phases']
        if not green_phases:
            return

        # Baseline: strictly cycle clockwise every 10 steps
        new_phase_idx = (s['current_phase_idx'] + 1) % len(green_phases)

        # Apply phase change with yellow transition
        if new_phase_idx != s['current_phase_idx']:
            res = traci_conn.trafficlight.getSubscriptionResults(self.tl_id)
            current_sumo_phase = res.get(tc.TL_CURRENT_PHASE) if res else traci_conn.trafficlight.getPhase(self.tl_id)
            target_green = green_phases[new_phase_idx]

            if target_green != current_sumo_phase:
                # Find the yellow phase between current green and next green
                logic = traci_conn.trafficlight.getAllProgramLogics(self.tl_id)[0]
                yellow_phase = (current_sumo_phase + 1) % len(logic.phases)
                
                # Check if it's actually a yellow phase
                phase_state = logic.phases[yellow_phase].state.lower()
                if 'y' not in phase_state:
                    # If not yellow, just jump to green (failsafe)
                    traci_conn.trafficlight.setPhase(self.tl_id, target_green)
                    traci_conn.trafficlight.setPhaseDuration(self.tl_id, 9999)
                    s['current_phase_idx'] = new_phase_idx
                else:
                    traci_conn.trafficlight.setPhase(self.tl_id, yellow_phase)
                    traci_conn.trafficlight.setPhaseDuration(self.tl_id, 9999)
                    s['yellow_active'] = True
                    s['yellow_remaining'] = self.yellow_duration
                    s['current_phase_idx'] = new_phase_idx

    def get_observations(self, traci_conn, lane_sub_results=None):
        """Haal queues, voertuig-aantallen, wachttijden en snelheden op."""
        obs = []
        # Use provided results or fetch all at once
        subs = lane_sub_results if lane_sub_results is not None else traci_conn.lane.getAllSubscriptionResults()
        
        for lane in self.state['lanes']:
            res = subs.get(lane)
            if res:
                # 0x14: Halting number, 0x10: Vehicle number, 0x7a: Waiting time, 0x41: Mean speed
                q = res.get(0x14, 0)
                c = res.get(0x10, 0)
                w = res.get(0x7a, 0)
                s = res.get(0x41, 0)
                obs.extend([
                    min(q / 20.0, 1.0),
                    min(c / 20.0, 1.0),
                    min(w / 300.0, 1.0),
                    min(s / 15.0, 1.0)
                ])
            else:
                obs.extend([0.0, 0.0, 0.0, 0.0])
        
        # Pad to exactly 8 lanes (8 * 4 = 32 features)
        while len(obs) < 32:
            obs.extend([0.0, 0.0, 0.0, 0.0])
        return obs[:32]

    def needs_decision(self):
        """Check if this TM is ready for a new decision (not in yellow, past min green)."""
        s = self.state
        if s['yellow_active']:
            return False
        if s['step_counter'] < self.steps_per_action:
            return False
        if s['green_step_counter'] < self.min_green_duration:
            return False
        return True


async def batch_predict_ai(traffic_managers, traci_conn, intensity, model_path=None):
    """
    Collect observations from ALL traffic managers that need a decision,
    send a single batch prediction request to the backend, and apply results.
    This replaces 28 individual HTTP calls with 1.
    """
    # Build batch payload
    predictions = []
    decision_tms = []
    observations_by_tls = {}

    # Fetch all lane results ONCE for all traffic managers
    lane_sub_results = traci_conn.lane.getAllSubscriptionResults()

    for tm in traffic_managers:
        tm.tick(traci_conn, delta_time=traci_conn.simulation.getDeltaT())
        if not tm.needs_decision():
            continue
        
        obs_lanes = tm.get_observations(traci_conn, lane_sub_results=lane_sub_results)
        res = traci_conn.trafficlight.getSubscriptionResults(tm.tl_id)
        # 0x28 = TL_CURRENT_PHASE
        current_phase = res.get(0x28) if res else traci_conn.trafficlight.getPhase(tm.tl_id)

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

    # Single batch HTTP call
    try:
        payload = {'predictions': predictions}
        if model_path:
            payload['model_path'] = model_path

        body = json.dumps(payload).encode('utf-8')
        import urllib.request
        req = urllib.request.Request(
            'http://backend:8000/rl/inference/predict_batch',
            data=body,
            headers={'Content-Type': 'application/json'}
        )

        loop = asyncio.get_running_loop()
        def _call():
            # Reduced timeout to 1.5s to prevent UI freezes
            with urllib.request.urlopen(req, timeout=1.5) as r:
                return json.loads(r.read().decode())
        
        resp = await loop.run_in_executor(None, _call)
        actions = resp.get('actions', {})

        decisions = []
        for tm in decision_tms:
            action = actions.get(tm.tl_id, -1)
            decision = tm.apply_action(traci_conn, action)
            obs_lanes = observations_by_tls.get(tm.tl_id, [])
            queue_estimate = sum(obs_lanes[0::4]) * 50.0
            vehicle_estimate = sum(obs_lanes[1::4]) * 50.0
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
                'queue_estimate': round(sum(obs_lanes[0::4]) * 50.0, 1),
                'vehicle_estimate': round(sum(obs_lanes[1::4]) * 50.0, 1),
                'waiting_time_estimate': round(sum(obs_lanes[2::4]) * 300.0, 1),
                'model': model_path,
                'fallback': True,
                'error': str(e),
            })
            decisions.append(decision)
        return decisions
