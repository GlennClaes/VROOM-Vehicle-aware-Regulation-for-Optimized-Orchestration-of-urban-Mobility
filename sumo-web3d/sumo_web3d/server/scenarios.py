# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import json
import os
import re

import xmltodict

from .xml_utils import get_only_key, parse_xml_file

DIR = os.path.join(os.path.dirname(__file__), '..')


def to_kebab_case(scenario_name):
    return scenario_name.lower().replace(' ', '-').replace('_', '-')


class Scenario(object):

    @classmethod
    def from_config_json(cls, scenarios_json):
        name = scenarios_json['name']
        config_file = scenarios_json['config_file']
        sumocfg_file = os.path.normpath(
            os.path.join(DIR, os.path.expanduser(os.path.expandvars(config_file)))
        )
        is_default = scenarios_json.get('is_default', False)
        presets = scenarios_json.get('presets', [])
        config_dir = os.path.dirname(sumocfg_file)
        print(f"Loading scenario config: {sumocfg_file}")
        parsed = xmltodict.parse(open(sumocfg_file).read(), attr_prefix='')
        config = parsed.get('configuration') or parsed.get('sumoConfiguration')
        if not config:
            raise Exception(f"{sumocfg_file} heeft geen geldige SUMO config root")
        net_file, additional_files, settings_file = parse_config_file(config_dir, config)
        additionals = {} if additional_files else None
        if additional_files:
            for xml in [parse_xml_file(f) for f in additional_files]:
                additional = xml.get('additional') or xml.get('add')
                if additional:
                    additionals.update(additional)

        settings = parse_xml_file(settings_file)
        water = {'type': 'FeatureCollection', 'features': []}
        if settings:
            water_tag = get_only_key(settings).get('water-geojson')
            if water_tag:
                water = json.load(open(os.path.join(config_dir, water_tag['value'])))

        return cls(
            sumocfg_file,
            name,
            is_default,
            presets,
            parse_xml_file(net_file),
            additionals,
            settings,
            water
        )

    def __init__(self, config_file, name, is_default, presets, network, additional, settings, water):
        self.config_file = config_file
        self.display_name = name
        self.name = to_kebab_case(name)
        self.is_default = is_default
        self.presets = presets
        self.network = network
        self.additional = additional
        self.settings = settings
        self.water = water


def parse_config_file(config_dir, config):
    input_config = config['input']
    net_file = os.path.join(config_dir, input_config['net-file']['value'])

    additionals = input_config.get('additional-files')
    if additionals:
        # additional-files can be a single dict, a list of dicts, or a string
        if isinstance(additionals, str):
            additionals = [{'value': additionals}]
        elif isinstance(additionals, dict):
            additionals = [additionals]
        # now additionals is always a list of dicts with a 'value' key
        additional_files = []
        for additional in additionals:
            values = re.split(r'[ ,]+', additional['value'])
            for value in values:
                additional_files.append(os.path.join(config_dir, value))
    else:
        additional_files = None

    settings_file = None
    if 'gui_only' in config and 'gui-settings-file' in config['gui_only']:
        settings_file = os.path.join(config_dir, config['gui_only']['gui-settings-file']['value'])
    print(f"Additional files: {additional_files}")
    return (net_file, additional_files, settings_file)


def load_scenarios_file(prev_scenarios, scenarios_file):
    next_scenarios = prev_scenarios
    if not scenarios_file:
        return next_scenarios

    with open(scenarios_file) as f:
        new_scenarios = json.loads(f.read())
        new_scenarios_names = [to_kebab_case(x['name']) for x in new_scenarios]
        duplicates = len(new_scenarios_names) == len(set(new_scenarios_names))
        if not duplicates:
            raise Exception(
                'Invalid scenarios.json, cannot have two scenarios with the'
                'same kebab case name'
            )
        prev_scenario_names = set([s.name for s in prev_scenarios.values()])
        updates = [s for s in new_scenarios if to_kebab_case(s['name']) not in prev_scenario_names]
        for new_scenario in updates:
            try:
                scenario = Scenario.from_config_json(new_scenario)
                next_scenarios.update({scenario.name: scenario})
            except Exception as e:
                print(f"FAILED to load scenario {new_scenario.get('name')}: {e}")
        return next_scenarios


def get_default_scenario_name(scenarios):
    """Find the Scenario with is_default, or a random one."""
    defaults = [k for k, s in scenarios.items() if s.is_default]
    if len(defaults) > 1:
        raise ValueError('Multiple scenarios with is_default set: %s', ', '.join(defaults))
    if len(defaults) == 0:
        if not scenarios:
            raise ValueError('No scenarios loaded. Check if the scenario files exist and are correctly configured.')
        return list(scenarios.keys())[0]  # fixed: dict_keys is not subscriptable
    return defaults[0]

def scenario_to_response_body(scenario):
    return {
        'displayName': scenario.display_name,
        'kebabCase': to_kebab_case(scenario.name),
        'presets': scenario.presets
    }
