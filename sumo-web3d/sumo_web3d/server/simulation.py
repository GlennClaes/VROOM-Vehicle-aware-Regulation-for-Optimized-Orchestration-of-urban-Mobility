# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import shlex
import time
from collections import Counter

import sumolib
import traci

from .converters import (
    TRACI_VEHICLE_CONSTANTS,
    TRACI_PERSON_CONSTANTS,
    vehicle_to_dict,
    person_to_dict,
    light_to_dict,
)
from .deltas import round_vehicles, diff_dicts

tc = traci.constants


def start_sumo_executable(gui, sumo_args, sumocfg_file, label='default'):
    print(f"[SIMULATION] start_sumo_executable() called with label '{label}' for scenario: {sumocfg_file}", flush=True)
    sumoBinary = sumolib.checkBinary('sumo' if not gui else 'sumo-gui')
    additional_args = shlex.split(sumo_args) if sumo_args else []
    args = [sumoBinary, '-c', sumocfg_file] + additional_args
    print('Executing %s' % ' '.join(args))

    try:
        print(f"[SIMULATION] Calling traci.start() with label '{label}'...", flush=True)
        traci.start(args, label=label)
        print(f"[SIMULATION] traci.start('{label}') returned successfully", flush=True)
    except Exception as e:
        print(f"[SIMULATION] ERROR in traci.start('{label}'): {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise

    conn = traci.getConnection(label)
    conn.simulation.subscribe()
    print(f"[SIMULATION] subscribed to simulation '{label}'", flush=True)

    for light_id in conn.trafficlight.getIDList():
        conn.trafficlight.subscribe(light_id, [tc.TL_CURRENT_PHASE, tc.TL_CURRENT_PROGRAM, tc.TL_RED_YELLOW_GREEN_STATE])
    print(f"[SIMULATION] Subscribed to {len(conn.trafficlight.getIDList())} lights in '{label}'", flush=True)

    # Subscribe to controlled lanes for performance
    all_controlled_lanes = set()
    for tl in conn.trafficlight.getIDList():
        try:
            all_controlled_lanes.update(conn.trafficlight.getControlledLanes(tl))
        except: pass
    
    for lane_id in all_controlled_lanes:
        # 0x10=VEH_NUM, 0x14=HALTING_NUM, 0x7a=WAIT_TIME, 0x11=MEAN_SPEED
        conn.lane.subscribe(lane_id, [0x10, 0x14, 0x7a, 0x11])
    print(f"[SIMULATION] Subscribed to {len(all_controlled_lanes)} lanes for metrics in '{label}'", flush=True)

    return args


def simulate_next_step(last_vehicles, last_lights, connection=None):
    """Run one simulation step and return (snapshot, updated_vehicles, updated_lights)."""
    if connection is None:
        connection = traci

    start_secs = time.time()
    try:
        connection.simulationStep()
    except Exception as e:
        print(f"[SIMULATION] ERROR in connection.simulationStep(): {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise
    end_sim_secs = time.time()

    # Update Vehicles efficiently without calling getIDList()
    if not hasattr(simulate_next_step, '_vehicle_ids'):
        simulate_next_step._vehicle_ids = set()
    
    # Add new vehicles
    for veh_id in connection.simulation.getDepartedIDList():
        connection.vehicle.subscribe(veh_id, TRACI_VEHICLE_CONSTANTS)
        simulate_next_step._vehicle_ids.add(veh_id)
    
    # Remove arrived vehicles and capture their final metrics
    for veh_id in connection.simulation.getArrivedIDList():
        # Capture final cumulative metrics before removing
        try:
            # Get last known values from the subscription results of the last step
            # If not available, we use a small heuristic or just skip
            res = connection.vehicle.getSubscriptionResults(veh_id)
            if res:
                wait = res.get(tc.VAR_WAITING_TIME, 0)
                loss = res.get(tc.VAR_TIMELOSS, 0)
                # TTT for this vehicle is current time - departure time
                dep_time = connection.vehicle.getDeparture(veh_id)
                curr_time = connection.simulation.getTime()
                
                if not hasattr(simulate_next_step, '_cum_tawt'): simulate_next_step._cum_tawt = 0.0
                if not hasattr(simulate_next_step, '_cum_ttt'): simulate_next_step._cum_ttt = 0.0
                if not hasattr(simulate_next_step, '_cum_tnr'): simulate_next_step._cum_tnr = 0.0
                
                simulate_next_step._cum_tawt += wait
                simulate_next_step._cum_ttt += (curr_time - dep_time)
                
                # Capture final reward contribution
                q_penalty = 1.0 if res.get(tc.VAR_SPEED, 0) < 0.1 else 0.0
                simulate_next_step._cum_tnr -= (q_penalty + wait + loss)
        except: pass
        
        simulate_next_step._vehicle_ids.discard(veh_id)

    # Fetch results for ALL active vehicles in one batch
    ids = list(simulate_next_step._vehicle_ids)
    vehicles = {}
    for veh_id in ids:
        res = connection.vehicle.getSubscriptionResults(veh_id)
        if res:
            vehicles[veh_id] = vehicle_to_dict(res)
        else:
            # Result not ready yet (likely just departed)
            # Try a direct call as fallback or just skip for one step
            pass

    # Update persons (Persons don't have getDepartedIDList in all versions)
    # Using IDList for persons is fine as they are usually few
    for ped_id in connection.person.getIDList():
        connection.person.subscribe(ped_id, TRACI_PERSON_CONSTANTS)

    persons = {}
    for ped_id in connection.person.getIDList():
        res = connection.person.getSubscriptionResults(ped_id)
        if res:
            persons[ped_id] = person_to_dict(res)

    vehicles.update(persons)
    vehicle_counts = Counter(v['vClass'] for veh_id, v in vehicles.items())
    round_vehicles(vehicles)
    vehicles_update = diff_dicts(last_vehicles, vehicles)

    # Update lights
    light_ids = connection.trafficlight.getIDList()
    lights = {
        l_id: light_to_dict(connection.trafficlight.getSubscriptionResults(l_id))
        for l_id in light_ids
    }
    lights_update = diff_dicts(last_lights, lights)

    # Calculate aggregate KPIs
    num_vehicles = len(vehicles)
    avg_speed = 0.0
    avg_waiting_time = 0.0
    if num_vehicles > 0:
        valid_speeds = [v['speed'] for v in vehicles.values() if v['speed'] >= 0]
        avg_speed = sum(valid_speeds) / len(valid_speeds) if valid_speeds else 0.0
        avg_waiting_time = sum(v.get('waiting_time', 0) for v in vehicles.values()) / num_vehicles
    
    arrived_ids = connection.simulation.getArrivedIDList()
    
    # Initialize persistent counters if they don't exist
    if not hasattr(simulate_next_step, '_cum_throughput'):
        simulate_next_step._cum_throughput = 0
        simulate_next_step._cum_tawt = 0.0
        simulate_next_step._cum_ttt = 0.0
        simulate_next_step._cum_tnr = 0.0
        simulate_next_step._last_time = current_time if 'current_time' in locals() else connection.simulation.getTime()

    # Update throughput
    simulate_next_step._cum_throughput += len(arrived_ids)
    throughput = simulate_next_step._cum_throughput

    # Capture data from arriving vehicles before they disappear
    for veh_id in arrived_ids:
        try:
            # We need to get these before the vehicle is gone, but getArrivedIDList is for vehicles that JUST arrived.
            # In SUMO, subscription results might still be available for one step, 
            # or we need to use traci.simulation.getArrivedPersonIDList / getArrivedIDList and then
            # ideally we should have cached their last known values.
            # A better way is to track them in our _vehicle_ids set and check when they are removed.
            pass
        except: pass

    # --- ADVANCED METRICS (D3QN Optimized - THROTTLED) ---
    # Only calculate expensive metrics every 10 steps to maintain high FPS
    current_time = connection.simulation.getTime()
    
    # Check if we should calculate metrics this step
    # Reduced frequency to every 20 seconds for large networks to prevent UI freezes
    should_calc_metrics = (int(current_time) % 20 == 0)
    
    if not hasattr(simulate_next_step, '_lane_cache') or simulate_next_step._lane_cache is None:
        tl_ids = connection.trafficlight.getIDList()
        all_in_lanes = set()
        all_out_lanes = set()
        for tl in tl_ids:
            try:
                all_in_lanes.update(connection.trafficlight.getControlledLanes(tl))
                links = connection.trafficlight.getControlledLinks(tl)
                for link in links:
                    for sublink in link:
                        if sublink and len(sublink) > 1: all_out_lanes.add(sublink[1])
            except: continue
        simulate_next_step._lane_cache = (list(all_in_lanes), list(all_out_lanes))
        simulate_next_step._lane_lengths = {l: connection.lane.getLength(l) for l in all_in_lanes}

    # Always calculate total load for completion rate
    total_ever_entered = simulate_next_step._cum_throughput + len(simulate_next_step._vehicle_ids)

    if should_calc_metrics:
        # 1. Intersection Delay (ID) - Use data already in subscription
        total_delay = sum(v.get('time_loss', 0) or 0 for v in vehicles.values())
        
        in_lanes, out_lanes = simulate_next_step._lane_cache
        
        # Use subscription results for lanes instead of individual calls
        pressure = 0
        halting_sum = 0
        nql_sum = 0.0
        wait_times = []
        
        lane_sub_results = connection.lane.getAllSubscriptionResults()
        
        for l in in_lanes:
            res = lane_sub_results.get(l)
            if res:
                veh_num = res.get(0x10, 0)
                halt_num = res.get(0x14, 0)
                wait_t = res.get(0x7a, 0)
                
                pressure += veh_num
                halting_sum += halt_num
                # Normalize halting vehicles by lane length to get Normalized Queue Length
                lane_len = max(simulate_next_step._lane_lengths.get(l, 100.0), 1.0)
                nql_sum += (halt_num / (lane_len / 5.0))
                wait_times.append(wait_t)
        
        for l in out_lanes:
            res = lane_sub_results.get(l)
            if res:
                pressure -= res.get(0x10, 0)
            
        avg_nql = nql_sum / len(in_lanes) if in_lanes else 0.0
        aql = halting_sum / len(in_lanes) if in_lanes else 0.0

        # 3. Total Travel Time (TTT) - Simplified to avoid per-vehicle calls
        # TTT = Sum of (current_time - departure). We can approximate this by 
        # using the current vehicles' speeds and waiting times if we don't want 1000 TraCI calls.
        # For now, let's just use a simplified version or the last known ttt to prevent lag.
        ttt = getattr(simulate_next_step, '_last_ttt', 0) + (num_vehicles * 1.0) # Placeholder increment

        # 4. Jain's Fairness
        if wait_times and sum(wait_times) > 0:
            sum_w = sum(wait_times)
            sum_sq_w = sum(w**2 for w in wait_times)
            fairness = (sum_w**2) / (len(wait_times) * sum_sq_w)
        else: fairness = 1.0

        # 5. Ratio
        tp_delay_ratio = throughput / (total_delay / 100.0 + 1e-6)

        # 6. Total Accumulated Wait Time (TAWT)
        # Sum of wait time of arrived vehicles + current active vehicles
        current_active_tawt = 0.0
        current_active_tnr_penalty = 0.0
        current_active_ttt = 0.0
        curr_time = connection.simulation.getTime()

        for vid, v in vehicles.items():
            # Check if this is a vehicle (persons are also in vehicles dict but might lack these keys)
            w = v.get('waiting_time', 0)
            l = v.get('time_loss', 0)
            s = v.get('speed', 0)
            d = v.get('departure', 0)
            
            current_active_tawt += w
            current_active_tnr_penalty -= ( (1.0 if s < 0.1 else 0.0) + w + l)
            current_active_ttt += (curr_time - d)
        
        tawt = simulate_next_step._cum_tawt + current_active_tawt
        tnr = simulate_next_step._cum_tnr + current_active_tnr_penalty
        ttt = simulate_next_step._cum_ttt + current_active_ttt
        
        # 7. Average Wait Time per Car (EWPC)
        total_ever_entered = simulate_next_step._cum_throughput + len(simulate_next_step._vehicle_ids)
        ewpc = tawt / total_ever_entered if total_ever_entered > 0 else 0.0
        
        # Store for next throttled steps
        simulate_next_step._last_metrics = {
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
        simulate_next_step._last_ttt = ttt
    else:
        # Use cached metrics if not calculating this step
        metrics = getattr(simulate_next_step, '_last_metrics', {
            'intersection_delay': 0, 'pressure': 0, 'ttt': 0, 'nql': 0,
            'fairness': 1.0, 'tp_delay_ratio': 0,
            'tawt': 0, 'ewpc': 0, 'aql': 0, 'tnr': 0,
        })
        total_delay = metrics['intersection_delay']
        pressure = metrics['pressure']
        ttt = metrics['ttt']
        avg_nql = metrics['nql']
        fairness = metrics['fairness']
        tp_delay_ratio = metrics['tp_delay_ratio']
        tawt = metrics['tawt']
        ewpc = metrics['ewpc']
        aql = metrics['aql']
        tnr = metrics['tnr']

    end_update_secs = time.time()

    snapshot = {
        'time': connection.simulation.getTime(),
        'vehicles': vehicles_update,
        'lights': lights_update,
        'vehicle_counts': vehicle_counts,
        'kpis': {
            'avg_speed': round(avg_speed, 2),
            'avg_waiting_time': round(avg_waiting_time, 2),
            'vehicle_count': num_vehicles,
            'throughput': throughput,
            'intersection_delay': round(total_delay, 2),
            'pressure': int(pressure),
            'ttt': round(ttt, 2),
            'nql': round(avg_nql, 4),
            'fairness': round(fairness, 3),
            'tp_delay_ratio': round(tp_delay_ratio, 4),
            'tnr': round(tnr, 2),
            'tawt': round(tawt, 1),
            'ewpc': round(ewpc, 1),
            'aql': round(aql, 2),
            'total_vehicles': total_ever_entered,
        },
        'simulate_secs': end_sim_secs - start_secs,
        'snapshot_secs': end_update_secs - end_sim_secs,
    }
    return snapshot, vehicles, lights
