#!/usr/bin/env python3
# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import argparse
import asyncio
import os

import websockets
from aiohttp import web

from .scenarios import Scenario, load_scenarios_file, to_kebab_case
import sys

# Compile C++ prediction engine on server startup
try:
    print("[SumoWeb3D] Compiling C++ prediction engine...", flush=True)
    try:
        from .rl_core.compile_cpp import compile_lib
    except ImportError:
        try:
            from rl_core.compile_cpp import compile_lib
        except ImportError:
            import sys
            import os
            sys.path.append(os.path.join(os.path.dirname(__file__), "rl_core"))
            from compile_cpp import compile_lib
    compile_lib()
except Exception as e:
    print(f"[SumoWeb3D] C++ prediction engine compilation skipped/failed: {e}", flush=True)

from .routes import setup_http_server
from .simulation import start_sumo_executable
from .websocket_handler import (
    STATUS_OFF,
    websocket_simulation_control,
)

DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# Zoek op meerdere plekken naar scenarios.json
SCENARIOS_PATH = os.path.join(DIR, 'scenarios.json')
if not os.path.exists(SCENARIOS_PATH):
    SCENARIOS_PATH = os.path.join(os.path.dirname(__file__), '..', 'scenarios.json')
if not os.path.exists(SCENARIOS_PATH):
    SCENARIOS_PATH = '/app/scenarios.json'

if not os.path.exists(SCENARIOS_PATH):
    print(f"[SumoWeb3D] CRITICAL: scenarios.json NOT FOUND! Contents of /app: {os.listdir('/app')}")
else:
    print(f"[SumoWeb3D] Found scenarios.json at: {SCENARIOS_PATH}")

print(f"[SumoWeb3D] Using scenarios path: {SCENARIOS_PATH}")

parser = argparse.ArgumentParser(description='Run the microsim python server.')
parser.add_argument(
    '-c', '--configuration-file', dest='configuration_file', default='',
    help='Run SUMO3D with a specific configuration. The default is to run '
         'with a built-in list of scenarios, e.g. for demoing.')
parser.add_argument(
    '--sumo-args', dest='sumo_args', default='',
    help='Additional arguments to pass to the sumo (or sumo-gui) process. '
         'For example, "--step-length 0.01" or "--scale 10".')
parser.add_argument(
    '--gui', action='store_true', default=False,
    help='Run sumo-gui rather than sumo. This is useful for debugging.')


async def async_main(args):
    scenarios_path = SCENARIOS_PATH

    # Shared mutable state passed by reference to all handlers
    state_ref = {
        'current_scenario': None,
        'delay_length_ms': 16,
        'simulation_status': STATUS_OFF,
        'strategy': 'baseline',
        'last_vehicles': {},
        'last_lights': {},
        'sumo_cmd_args': None,  # Will be set during start action
        'active_task': None,
        'connection_label': None,
        'update_interval': 1,
    }

    # Load scenarios
    if args.configuration_file:
        scenarios_path = None
        name = os.path.basename(args.configuration_file)
        scenarios = {
            to_kebab_case(name): Scenario.from_config_json({
                'name': name,
                'description': 'User-specified scenario',
                'config_file': args.configuration_file,
                'is_default': True,
            })
        }
    else:
        scenarios = load_scenarios_file({}, scenarios_path)

    # Pick a default scenario
    from .scenarios import get_default_scenario_name
    state_ref['current_scenario'] = scenarios[get_default_scenario_name(scenarios)]

    def sumo_start_fn(label='default'):
        update_interval = state_ref.get('update_interval', 1)
        # Note: --step-length requires a float or integer value. Add it to sumo_args
        current_sumo_args = f"{args.sumo_args} --step-length {update_interval}".strip()

        return start_sumo_executable(
            args.gui,
            current_sumo_args,
            state_ref['current_scenario'].config_file,
            label=label
        )

    async def ws_handler(websocket):
        addr = websocket.remote_address
        print(f"[SERVER] New WebSocket connection from {addr}", flush=True)
        try:
            await websocket_simulation_control(
                sumo_start_fn=sumo_start_fn,
                websocket=websocket,
                state_ref=state_ref,
            )
        finally:
            print(f"[SERVER] WebSocket connection from {addr} closed", flush=True)

    # Start WebSocket server
    print(f"[SERVER] Starting WebSocket server on 0.0.0.0:5678...", flush=True)
    ws_server = await websockets.serve(ws_handler, '0.0.0.0', 5678, origins=None)

    # Start HTTP server
    print(f"[SERVER] Setting up HTTP server routes...", flush=True)
    app = setup_http_server(None, scenarios_path, scenarios, state_ref)
    runner = web.AppRunner(app)
    await runner.setup()
    
    print(f"[SERVER] Starting HTTP site on 0.0.0.0:5000...", flush=True)
    site = web.TCPSite(runner, '0.0.0.0', 5000)
    await site.start()

    print(
        'Listening on:\n'
        '  http://localhost:5000  (HTTP)\n'
        '  ws://localhost:5678    (WebSockets)\n'
    )

    await asyncio.Future()  # run forever


def run():
    args = parser.parse_args()
    asyncio.run(async_main(args))


if __name__ == '__main__':
    run()
