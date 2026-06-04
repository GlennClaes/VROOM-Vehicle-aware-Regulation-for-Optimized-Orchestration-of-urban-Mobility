import os
import time
import uuid
import json
import redis
import traci
import asyncio
from .simulation import start_sumo_executable, simulate_next_step
from .traffic_manager import TrafficManager, batch_predict_ai

REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

def log(msg):
    print(msg, flush=True)

class SimulationWorker:
    def __init__(self, scenario_config, strategy='baseline', sam_model=None, update_interval=1, label=None):
        self.scenario_config = scenario_config
        self.strategy = strategy
        self.sam_model = sam_model
        self.update_interval = update_interval
        self.redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        self.connection_label = label if label else f"worker_{uuid.uuid4().hex[:8]}"
        self.running = False

    def run(self):
        log(f"[WORKER] Starting simulation for {self.scenario_config} with label {self.connection_label}...")
        
        sumo_args = f"--step-length {self.update_interval}"
        start_sumo_executable(False, sumo_args, self.scenario_config, label=self.connection_label)
        
        conn = traci.getConnection(self.connection_label)
        
        # Intensity based on scenario
        intensity = 0.7
        name = self.scenario_config.lower()
        if 'night' in name: intensity = 0.2
        elif 'quiet' in name: intensity = 0.4
        elif 'rush' in name: intensity = 1.0

        all_tl_ids = conn.trafficlight.getIDList()
        traffic_managers = []
        for tls_id in all_tl_ids:
            tm = TrafficManager(tls_id)
            tm.initialize(conn)
            traffic_managers.append(tm)

        last_vehicles = {}
        last_lights = {}
        self.running = True
        
        # Check if we should start in paused mode (Pre-loading)
        initial_cmd = self.redis.get(f"sim:{self.connection_label}:cmd")
        is_paused = (initial_cmd == 'pause')
        if is_paused:
            log(f"[WORKER] Starting in PRE-LOAD (paused) mode for {self.connection_label}")

        # Default target: 10 FPS (0.1s per step) for better stability in large networks
        step_time_target = 0.1 
        loop = asyncio.new_event_loop()
        
        try:
            step_count = 0
            while self.running:
                start_time = time.time()
                
                # 1. READ CONTROL COMMANDS & SPEED
                pipe = self.redis.pipeline()
                pipe.get(f"sim:{self.connection_label}:cmd")
                pipe.get(f"sim:{self.connection_label}:delay")
                res = pipe.execute()
                
                cmd = res[0]
                delay_val = res[1]
                
                if cmd == 'stop':
                    log(f"[WORKER] Stop command received for {self.connection_label}")
                    break
                
                # Pre-loading / Pause loop: always allow the first frame (step_count == 0) to prime the UI
                if (cmd == 'pause' or (is_paused and not cmd)) and step_count > 0:
                    time.sleep(0.1)
                    continue
                
                # Once we get a 'run' command, disable the initial pause flag
                if cmd == 'run':
                    is_paused = False

                step_count += 1

                if delay_val is not None:
                    step_time_target = max(0.02, float(delay_val) / 1000.0)

                # 2. STRATEGY LOGIC
                ai_decisions = []
                if self.strategy == 'sam':
                    from .traffic_manager import batch_predict_ai
                    ai_decisions = loop.run_until_complete(batch_predict_ai(traffic_managers, conn, intensity, self.sam_model))
                else:
                    for tm in traffic_managers:
                        loop.run_until_complete(tm.update(conn, self.strategy, intensity))

                # 3. PHYSICS STEP (Returns a Delta)
                snapshot, last_vehicles, last_lights = simulate_next_step(last_vehicles, last_lights, connection=conn)
                
                # 4. OPTIMIZE DELTA SNAPSHOT
                # We only keep visual keys in the creations and updates
                visual_keys = {'x', 'y', 'z', 'angle', 'type', 'vClass', 'length', 'width'}
                
                def strip_non_visual(d):
                    return {k: v for k, v in d.items() if k in visual_keys}

                if not hasattr(self, '_last_sent'): self._last_sent = {}
                creations = {}
                for vid, v in snapshot['vehicles']['creations'].items():
                    creations[vid] = {k: v for k, v in v.items() if k in visual_keys}
                    self._last_sent[vid] = (v.get('x',0), v.get('y',0), v.get('angle',0))
                
                updates = {}
                for vid, v in snapshot['vehicles']['updates'].items():
                    curr = (v.get('x',0), v.get('y',0), v.get('angle',0))
                    prev = self._last_sent.get(vid)
                    moved = True
                    if prev:
                        if (curr[0]-prev[0])**2 + (curr[1]-prev[1])**2 < 0.01 and abs(curr[2]-prev[2]) < 1.0:
                            moved = False
                    if moved:
                        updates[vid] = {k: v for k, v in v.items() if k in visual_keys}
                        self._last_sent[vid] = curr
                
                for vid in snapshot['vehicles']['removals']:
                    if vid in self._last_sent: del self._last_sent[vid]
                
                # Only include full KPIs every 20 steps (approx 1s), but ALWAYS for the first 20 steps to prime the UI
                include_kpis = (step_count <= 20) or (step_count % 20 == 1)
                
                payload = {
                    'type': 'snapshot',
                    'time': snapshot['time'],
                    'vehicles': {
                        'creations': creations,
                        'updates': updates,
                        'removals': snapshot['vehicles']['removals']
                    },
                    'lights': snapshot['lights'],
                    'connection_label': self.connection_label,
                    'vehicleCounts': snapshot['vehicle_counts']
                }
                
                if include_kpis:
                    payload['kpis'] = snapshot['kpis']
                    if step_count % 20 == 1:
                        log(f"[WORKER] {self.connection_label} @ {snapshot['time']}s | Vehicles: {snapshot['kpis']['vehicle_count']}")

                if ai_decisions:
                    payload['ai_decisions'] = [
                        {
                            **decision,
                            'timestep': step_count,
                            'time': snapshot['time'],
                            'strategy': self.strategy,
                        }
                        for decision in ai_decisions
                    ]

                # 5. PUSH TO REDIS
                json_payload = json.dumps(payload)
                self.redis.set(f"sim:{self.connection_label}:state", json_payload)
                self.redis.publish(f"sim:{self.connection_label}:stream", json_payload)
                
                # 6. THROTTLING
                elapsed = time.time() - start_time
                sleep_time = max(0, step_time_target - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                
                if conn.simulation.getMinExpectedNumber() <= 0 and step_count > 100:
                    log(f"[WORKER] Simulation finished for {self.connection_label}")
                    
                    # Send a final 'finished' message so the frontend can show a notification
                    finish_payload = {
                        'type': 'finished',
                        'time': snapshot['time'],
                        'kpis': snapshot['kpis'],
                        'connection_label': self.connection_label
                    }
                    self.redis.publish(f"sim:{self.connection_label}:stream", json.dumps(finish_payload))
                    break
        except Exception as e:
            log(f"[WORKER ERR] {e}")
            import traceback
            traceback.print_exc()
        finally:
            log(f"[WORKER] Cleaning up {self.connection_label}")
            try: conn.close()
            except: pass
            try:
                self.redis.delete(f"sim:{self.connection_label}:state")
                self.redis.delete(f"sim:{self.connection_label}:cmd")
                self.redis.delete(f"sim:{self.connection_label}:delay")
            except: pass

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--strategy', default='baseline')
    parser.add_argument('--model', default=None)
    parser.add_argument('--interval', type=float, default=1.0)
    parser.add_argument('--label', default=None)
    args = parser.parse_args()
    
    worker = SimulationWorker(args.config, args.strategy, args.model, args.interval, args.label)
    worker.run()
