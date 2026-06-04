# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import functools
import json
import os

import xmltodict
from aiohttp import web

from .xml_utils import get_only_key

SUMO_HOME = os.environ.get('SUMO_HOME', '')
from .scenarios import scenario_to_response_body, get_default_scenario_name, load_scenarios_file

DIR = os.path.join(os.path.dirname(__file__), '..')
NO_CACHE_HEADER = {'cache-control': 'no-cache'}

def get_index_html():
    # Zoek index.html in root (dev) of static (prod)
    if os.environ.get('ENV') == 'production':
        paths = [
            os.path.join(DIR, 'static', 'index.html'),
            os.path.join(DIR, 'sumo_web3d', 'static', 'index.html'),
            os.path.join(DIR, 'index.html'),
            os.path.join(DIR, '..', 'index.html')
        ]
    else:
        paths = [
            os.path.join(DIR, 'index.html'),
            os.path.join(DIR, '..', 'index.html'),
            os.path.join(DIR, 'static', 'index.html'),
            os.path.join(DIR, 'sumo_web3d', 'static', 'index.html')
        ]
    for p in paths:
        if os.path.exists(p):
            return open(p).read()
    raise FileNotFoundError(f"index.html niet gevonden in {paths}")


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


# ── Decorators ──────────────────────────────────────────────────────────────

def send_as_http_response(func):
    def func_wrapper(*args, **kwargs):
        data = func(*args, **kwargs)
        if data and type(data) == str:
            return web.Response(text=data, headers=CORS_HEADERS)
        elif data and type(data) != str:
            raise Exception(
                'fail to send as response, expecting string, received: {}'.format(type(data))
            )
        else:
            return web.Response(status=404, text='Not found', headers=CORS_HEADERS)
    return func_wrapper


def serialize_as_json_string(func):
    def func_wrapper(*args, **kwargs):
        data = func(*args, **kwargs)
        if data:
            return json.dumps(data)
        else:
            return None
    return func_wrapper


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_xml_endpoint(path):
    text = None
    if path:
        r = xmltodict.parse(open(path).read(), attr_prefix='')
        text = json.dumps(r)

    async def handler(request):
        if text:
            return web.Response(text=text)
        else:
            return web.Response(status=404, text='Not found')

    return handler


def make_additional_endpoint(paths):
    if not paths:
        return make_xml_endpoint(paths)
    additionals = {}
    for path in paths:
        r = xmltodict.parse(open(path).read(), attr_prefix='')
        additionals.update(r['additional'])
    text = json.dumps({'additional': additionals})

    async def handler(request):
        return web.Response(text=text)

    return handler


# ── Route handlers ───────────────────────────────────────────────────────────

@send_as_http_response
@serialize_as_json_string
def scenario_attribute_route(scenarios_file, scenarios, attribute, normalized_key, request):
    requested_scenario = request.match_info['scenario']
    if requested_scenario not in scenarios:
        scenarios = load_scenarios_file(scenarios, scenarios_file)
    if requested_scenario in scenarios:
        obj = getattr(scenarios[requested_scenario], attribute)
        if normalized_key and obj:
            obj = {normalized_key: get_only_key(obj)}
        return obj
    else:
        return None


def get_new_scenario(scenarios, request):
    """Set a new scenario and respond with index.html."""
    import builtins
    # current_scenario is managed in server.py via a mutable container
    scenario_name = request.match_info['scenario']
    print('Switching to %s' % scenario_name)
    html = get_index_html()
    return web.Response(text=html, content_type='text/html', headers=NO_CACHE_HEADER)


def setup_http_server(task, scenario_file, scenarios, state_ref):
    """
    state_ref: a dict with keys 'current_scenario', 'delay_length_ms', 'simulation_status'
               so route handlers can read/write shared mutable state.
    """
    import traci  # imported here to avoid import-time side effects

    app = web.Application()

    scenarios_response = [scenario_to_response_body(x) for x in scenarios.values()]
    default_scenario_name = get_default_scenario_name(scenarios)

    # ── Bestaande Handlers ──────────────────────────────────────────────────

    pass # CORS_HEADERS removed

    def state_http_response(request):
        return web.Response(text=json.dumps(_get_state(state_ref)), headers=CORS_HEADERS)

    async def state_options_handler(request):
        return web.Response(status=204, headers=CORS_HEADERS)

    async def post_state_handler(request):
        body = await request.json()
        if body['scenario'] not in scenarios.keys():
            return web.Response(status=400, text='Unknown scenario', headers=CORS_HEADERS)

        # Als er een scenario switch plaatsvind EN status is OFF, gewoon update
        # Maar als er ACTIEF een simulatie draait, moet die eerst stoppen
        if state_ref['simulation_status'] != 'off' and state_ref['current_scenario'].name != body['scenario']:
            print(f"[ROUTES] Scenario switch detected while running: {state_ref['current_scenario'].name} -> {body['scenario']}")
            print(f"[ROUTES] Setting status to OFF to force stop before scenario change")
            state_ref['simulation_status'] = 'off'

        state_ref['current_scenario'] = scenarios[body['scenario']]
        state_ref['delay_length_ms'] = body['delay_length_ms']
        state_ref['simulation_status'] = body['simulation_status']
        if 'strategy' in body:
            state_ref['strategy'] = body['strategy']
        if 'sam_model' in body:
            state_ref['sam_model'] = body['sam_model']
        if 'update_interval' in body:
            state_ref['update_interval'] = body['update_interval']
        return web.Response(text=json.dumps(_get_state(state_ref)), headers=CORS_HEADERS)

    def vehicle_route_http_response(request):
        vehicle_id = request.query_string
        vehicle = state_ref['last_vehicles'].get(vehicle_id)
        if vehicle:
            if vehicle['vClass'] == 'pedestrian':
                edge_ids = traci.person.getEdges(vehicle_id)
            else:
                edge_ids = traci.vehicle.getRoute(vehicle_id)
            if edge_ids:
                return web.Response(text=json.dumps(edge_ids))
        return web.Response(status=404)

    def new_scenario_handler(request):
        scenario_name = request.match_info['scenario']
        if scenario_name not in scenarios:
            return web.Response(status=404, text=f'Scenario {scenario_name} not found')
        state_ref['current_scenario'] = scenarios[scenario_name]

        try:
            html = get_index_html()
            return web.Response(text=html, content_type='text/html', headers=NO_CACHE_HEADER)
        except FileNotFoundError as e:
            return web.Response(status=500, text=str(e))

    def additional_route_handler(request):
        requested_scenario = request.match_info['scenario']
        if requested_scenario in scenarios:
            obj = scenarios[requested_scenario].additional
            if obj:
                # Frontend expects only poly/busStop/tlLogic, no wrapper, no XML metadata keys
                filtered = {k: v for k, v in obj.items()
                            if k in ('poly', 'busStop', 'tlLogic')}
                return web.Response(text=json.dumps(filtered), headers=CORS_HEADERS)
        return web.Response(status=404, text='Not found', headers=CORS_HEADERS)

    async def save_scenario_handler(request):
        requested_scenario = request.match_info['scenario']
        body = await request.json()
        preset_id = body.get('preset_id')
        
        if requested_scenario not in scenarios:
            return web.Response(status=404, text='Scenario not found', headers=CORS_HEADERS)
        
        # Update in-memory scenario
        scenario = scenarios[requested_scenario]
        
        # Update scenarios.json file
        try:
            from .scenarios import to_kebab_case
            with open(scenario_file, 'r') as f:
                scenarios_data = json.load(f)
            
            found_scenario = None
            for s in scenarios_data:
                if to_kebab_case(s['name']) == requested_scenario:
                    found_scenario = s
                    break
            
            if found_scenario:
                # Find the preset to update
                presets = found_scenario.get('presets', [])
                target_preset = None
                
                if preset_id:
                    for p in presets:
                        if p.get('id') == preset_id:
                            target_preset = p
                            break
                
                # If no preset_id or not found, we could create a new one, 
                # but for now let's just update the first one or the specific one
                if not target_preset and presets:
                    target_preset = presets[0]
                
                if target_preset:
                    if 'update_interval' in body:
                        target_preset['update_interval'] = body['update_interval']
                    if 'strategy' in body:
                        target_preset['strategy'] = body['strategy']
                    if 'sam_model' in body:
                        target_preset['sam_model'] = body['sam_model']
                
                # Sync back to in-memory object too
                scenario.presets = found_scenario.get('presets', [])
                
                with open(scenario_file, 'w') as f:
                    json.dump(scenarios_data, f, indent=2)
                
            return web.Response(text=json.dumps({'status': 'success'}), headers=CORS_HEADERS)
        except Exception as e:
            print(f"[ROUTES] Failed to save scenario preset: {e}")
            import traceback
            traceback.print_exc()
            return web.Response(status=500, text=str(e), headers=CORS_HEADERS)

    async def create_preset_handler(request):
        requested_scenario = request.match_info['scenario']
        body = await request.json()
        
        if requested_scenario not in scenarios:
            return web.Response(status=404, text='Scenario not found', headers=CORS_HEADERS)
        
        import uuid
        new_preset = {
            "id": f"preset-{str(uuid.uuid4())[:8]}",
            "name": body.get('name', 'Nieuwe Configuratie'),
            "strategy": body.get('strategy', 'baseline'),
            "update_interval": body.get('update_interval', 1),
            "sam_model": body.get('sam_model', '')
        }
        
        try:
            from .scenarios import to_kebab_case
            with open(scenario_file, 'r') as f:
                scenarios_data = json.load(f)
            
            found_scenario = None
            for s in scenarios_data:
                if to_kebab_case(s['name']) == requested_scenario:
                    found_scenario = s
                    break
            
            if found_scenario:
                if 'presets' not in found_scenario:
                    found_scenario['presets'] = []
                found_scenario['presets'].append(new_preset)
                
                # Sync back to in-memory object
                scenarios[requested_scenario].presets = found_scenario['presets']
                
                with open(scenario_file, 'w') as f:
                    json.dump(scenarios_data, f, indent=2)
                
                return web.Response(text=json.dumps(new_preset), headers=CORS_HEADERS)
            return web.Response(status=404, text='Scenario not found in file', headers=CORS_HEADERS)
        except Exception as e:
            print(f"[ROUTES] Failed to create preset: {e}")
            return web.Response(status=500, text=str(e), headers=CORS_HEADERS)

    # ── NIEUW: Handler voor directe /network aanvraag ───────────────────────

    # ── Quick Handlers voor directe aanvraag zonder scenario-naam ──
    
    async def quick_network_handler(request):
        current = state_ref.get('current_scenario')
        if not current and scenarios:
            current = list(scenarios.values())[0]
        if current:
            request.match_info['scenario'] = current.name
            return scenario_attribute_route(scenario_file, scenarios, 'network', None, request)
        return web.Response(status=404, text='Geen scenario actief')

    async def quick_additional_handler(request):
        current = state_ref.get('current_scenario')
        if current:
            request.match_info['scenario'] = current.name
            return additional_route_handler(request)
        return web.Response(status=404, text='Geen scenario actief')

    async def quick_water_handler(request):
        current = state_ref.get('current_scenario')
        if current:
            request.match_info['scenario'] = current.name
            return scenario_attribute_route(scenario_file, scenarios, 'water', None, request)
        return web.Response(status=404, text='Geen scenario actief')

    async def quick_settings_handler(request):
        current = state_ref.get('current_scenario')
        if current:
            request.match_info['scenario'] = current.name
            return scenario_attribute_route(scenario_file, scenarios, 'settings', 'viewsettings', request)
        return web.Response(status=404, text='Geen scenario actief')

    # Routes
    app.router.add_get('/network', quick_network_handler)
    app.router.add_get('/additional', quick_additional_handler)
    app.router.add_get('/water', quick_water_handler)
    app.router.add_get('/settings', quick_settings_handler)
    app.router.add_get('/vehicles', lambda r: web.Response(text=json.dumps(state_ref.get('last_vehicles', {})), headers=CORS_HEADERS))

    app.router.add_get(
        '/scenarios/{scenario}/additional',
        additional_route_handler
    )
    app.router.add_get(
        '/scenarios/{scenario}/network',
        functools.partial(scenario_attribute_route, scenario_file, scenarios, 'network', None)
    )
    app.router.add_get(
        '/scenarios/{scenario}/water',
        functools.partial(scenario_attribute_route, scenario_file, scenarios, 'water', None)
    )
    app.router.add_get(
        '/scenarios/{scenario}/settings',
        functools.partial(
            scenario_attribute_route, scenario_file, scenarios, 'settings', 'viewsettings')
    )
    app.router.add_get('/scenarios/{scenario}/', new_scenario_handler)
    app.router.add_get(
        '/scenarios',
        lambda request: web.Response(text=json.dumps(scenarios_response), headers=CORS_HEADERS)
    )
    app.router.add_get(
        '/poly-convert',
        make_xml_endpoint(
            os.path.join(SUMO_HOME, 'data/typemap/osmPolyconvert.typ.xml'))
    )
    app.router.add_get('/state', state_http_response)
    app.router.add_post('/state', post_state_handler)
    app.router.add_post('/scenarios/{scenario}/save', save_scenario_handler)
    app.router.add_post('/scenarios/{scenario}/presets', create_preset_handler)
    app.router.add_route('OPTIONS', '/scenarios/{scenario}/save', state_options_handler)
    app.router.add_route('OPTIONS', '/scenarios/{scenario}/presets', state_options_handler)
    app.router.add_route('OPTIONS', '/state', state_options_handler)
    app.router.add_get('/vehicle_route', vehicle_route_http_response)

    # Removed camera and AI vision routes per request
    # ─────────────────────────────────────────────────────────────────────────

    async def index_handler(request):
        if 'iframe' in request.query:
            # Serve index.html directly for the current/default scenario without redirecting
            # This preserves the iframe window reference for the parent dashboard
            try:
                html = get_index_html()
                return web.Response(text=html, content_type='text/html', headers=NO_CACHE_HEADER)
            except FileNotFoundError as e:
                return web.Response(status=500, text=str(e))
        
        # Normal browser access: redirect to default scenario
        return web.HTTPFound('/scenarios/%s/' % default_scenario_name, headers=NO_CACHE_HEADER)

    app.router.add_get('/', index_handler)

    # We laten de static route staan voor compatibiliteit
    app.router.add_static('/', path=os.path.join(DIR, 'static'))

    return app


def _get_state(state_ref):
    from .scenarios import to_kebab_case
    return {
        'delayMs': state_ref['delay_length_ms'],
        'scenario': to_kebab_case(getattr(state_ref['current_scenario'], 'name')),
        'simulationStatus': state_ref['simulation_status'],
        'strategy': state_ref.get('strategy', 'baseline'),
    }
