import asyncio
import json
import traci
import websockets
import sys
import uuid
import os
import redis.asyncio as redis
import subprocess

STATUS_OFF = 'off'
STATUS_LOADING = 'loading'
STATUS_RUNNING = 'running'
STATUS_PAUSED = 'paused'

REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

def log(msg):
    print(msg, flush=True)

async def cleanup_sumo_simulation(simulation_task, state_ref, connection_label=None):
    log(f"[SumoWeb3D] Cleanup: {connection_label}")
    if simulation_task and not simulation_task.done():
        simulation_task.cancel()
        try: await simulation_task
        except: pass

    state_ref['simulation_status'] = STATUS_OFF
    if connection_label:
        try:
            r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
            await r.set(f"sim:{connection_label}:cmd", "stop")
            await r.close()
        except: pass
    return None

def _get_state_message(state_ref):
    from .scenarios import to_kebab_case
    scenario_name = 'default'
    if state_ref.get('current_scenario'):
        scenario_name = to_kebab_case(getattr(state_ref['current_scenario'], 'name', 'default'))
    
    return {
        'type': 'state',
        'delayMs': state_ref.get('delay_length_ms', 16),
        'scenario': scenario_name,
        'strategy': state_ref.get('strategy', 'baseline'),
        'simulationStatus': state_ref.get('simulation_status', STATUS_OFF),
    }

async def run_simulation_redis(websocket, state_ref, connection_label):
    log(f"[SumoWeb3D] Starting Redis consumer for {connection_label}...")
    r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"sim:{connection_label}:stream")

    try:
        # If we were paused, keep the status as paused, otherwise running
        if state_ref['simulation_status'] != STATUS_PAUSED:
            state_ref['simulation_status'] = STATUS_RUNNING
        
        await websocket.send(json.dumps(_get_state_message(state_ref)))

        last_send_time = 0
        target_fps = 20
        min_interval = 1.0 / target_fps

        async for message in pubsub.listen():
            if message['type'] != 'message': continue
            
            status = state_ref.get('simulation_status')
            if status == STATUS_OFF: break
            
            now = asyncio.get_event_loop().time()
            if now - last_send_time >= min_interval:
                await websocket.send(message['data'])
                last_send_time = now

    except Exception as e:
        log(f"[SumoWeb3D ERR] Consumer error: {e}")
    finally:
        await pubsub.unsubscribe(f"sim:{connection_label}:stream")
        await r.close()
        # Don't force OFF here, as we might be pre-loading another one
        # state_ref['simulation_status'] = STATUS_OFF

async def websocket_simulation_control(sumo_start_fn, websocket, state_ref):
    # Send initial state
    await websocket.send(json.dumps(_get_state_message(state_ref)))
    
    while True:
        try:
            raw_msg = await websocket.recv()
            log(f"[WS] Received: {raw_msg[:100]}...")
            msg = json.loads(raw_msg)
            if msg['type'] != 'action': 
                log(f"[WS] Skipping non-action message type: {msg['type']}")
                continue

            action = msg['action']
            log(f"[WS] Processing action: {action}")
            
            if action == 'preload' or action == 'start':
                # Check if we already have a worker for this session
                if action == 'start' and state_ref['simulation_status'] == STATUS_PAUSED:
                    log(f"[SERVER] Resuming preloaded worker {state_ref['connection_label']}")
                    r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
                    await r.set(f"sim:{state_ref['connection_label']}:cmd", "run")
                    await r.close()
                    state_ref['simulation_status'] = STATUS_RUNNING
                    await websocket.send(json.dumps(_get_state_message(state_ref)))
                    continue

                if state_ref['active_task']:
                    log(f"[SERVER] Cleaning up existing task before {action}")
                    await cleanup_sumo_simulation(state_ref['active_task'], state_ref, state_ref['connection_label'])

                state_ref['simulation_status'] = STATUS_LOADING
                await websocket.send(json.dumps(_get_state_message(state_ref)))

                config = state_ref['current_scenario'].config_file
                strategy = state_ref.get('strategy', 'baseline')
                model = state_ref.get('sam_model', '')
                interval = state_ref.get('update_interval', 1.0)
                
                session_label = f"sim_{uuid.uuid4().hex[:8]}"
                state_ref['connection_label'] = session_label
                log(f"[SERVER] New session label: {session_label}")

                # If it's a preload, set cmd to 'pause' BEFORE spawning
                r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
                if action == 'preload':
                    await r.set(f"sim:{session_label}:cmd", "pause")
                await r.close()

                cmd = [
                    "python3", "-m", "sumo_web3d.server.worker",
                    "--config", config,
                    "--strategy", strategy,
                    "--interval", str(interval),
                    "--label", session_label
                ]
                if model: cmd.extend(["--model", model])
                
                log(f"[SERVER] Spawning worker: {' '.join(cmd)}")
                try:
                    subprocess.Popen(cmd, env=os.environ.copy(), stdout=sys.stdout, stderr=sys.stderr)
                    log(f"[SERVER] Worker process spawned successfully")
                except Exception as spawn_err:
                    log(f"[SERVER ERR] Failed to spawn worker: {spawn_err}")
                    state_ref['simulation_status'] = STATUS_OFF
                    await websocket.send(json.dumps(_get_state_message(state_ref)))
                    continue

                log(f"[SERVER] Waiting for worker {session_label} to register in Redis...")
                r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
                found = False
                for i in range(200):
                    if await r.exists(f"sim:{session_label}:state"):
                        found = True
                        log(f"[SERVER] Worker {session_label} registered after {i*0.1:.1f}s")
                        break
                    await asyncio.sleep(0.1)
                
                if found:
                    if action == 'preload':
                        state_ref['simulation_status'] = STATUS_PAUSED
                    else:
                        state_ref['simulation_status'] = STATUS_RUNNING
                    state_ref['active_task'] = asyncio.create_task(run_simulation_redis(websocket, state_ref, session_label))
                    log(f"[SERVER] active_task created for {session_label}")
                else:
                    log(f"[SERVER ERR] Worker {session_label} timed out during registration.")
                    state_ref['simulation_status'] = STATUS_OFF
                await websocket.send(json.dumps(_get_state_message(state_ref)))

            elif action == 'pause': 
                state_ref['simulation_status'] = STATUS_PAUSED
                r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
                await r.set(f"sim:{state_ref['connection_label']}:cmd", "pause")
                await r.close()
            elif action == 'resume': 
                state_ref['simulation_status'] = STATUS_RUNNING
                r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
                await r.set(f"sim:{state_ref['connection_label']}:cmd", "run")
                await r.close()
            elif action == 'cancel':
                if state_ref['active_task']:
                    await cleanup_sumo_simulation(state_ref['active_task'], state_ref, state_ref['connection_label'])
                state_ref['active_task'] = None

            elif action == 'changeDelay': 
                new_delay = msg['delayLengthMs']
                state_ref['delay_length_ms'] = new_delay
                if state_ref['connection_label']:
                    r = await redis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}")
                    await r.set(f"sim:{state_ref['connection_label']}:delay", new_delay)
                    await r.close()
            elif action == 'changeStrategy': state_ref['strategy'] = msg.get('strategy', 'baseline')

            await websocket.send(json.dumps(_get_state_message(state_ref)))
        except websockets.exceptions.ConnectionClosed: break
        except Exception as e: 
            log(f"[WS ERR] {e}")
            import traceback
            traceback.print_exc()
