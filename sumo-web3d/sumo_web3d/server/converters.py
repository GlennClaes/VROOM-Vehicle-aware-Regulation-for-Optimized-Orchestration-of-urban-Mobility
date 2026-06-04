# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import traci
tc = traci.constants

TRACI_CONSTANTS = [
    tc.VAR_TYPE,
    tc.VAR_SPEED,
    tc.VAR_ANGLE,
    tc.VAR_LENGTH,
    tc.VAR_WIDTH,
]

TRACI_PERSON_CONSTANTS = TRACI_CONSTANTS + [
    tc.VAR_POSITION,
    tc.VAR_VEHICLE
]

_VAR_DEPART_CONST = [getattr(tc, 'VAR_DEPARTURE')] if hasattr(tc, 'VAR_DEPARTURE') else []
TRACI_VEHICLE_CONSTANTS = TRACI_CONSTANTS + [
    tc.VAR_POSITION3D,
    tc.VAR_SIGNALS,
    tc.VAR_VEHICLECLASS,
    tc.VAR_WAITING_TIME,
    tc.VAR_TIMELOSS,
] + _VAR_DEPART_CONST


def person_to_dict(person):
    """Extracts relevant information from traci.person.getSubscriptionResults."""
    return {
        'x': person[tc.VAR_POSITION][0],
        'y': person[tc.VAR_POSITION][1],
        'z': 0,
        'speed': person[tc.VAR_SPEED],
        'angle': person[tc.VAR_ANGLE],
        'type': person[tc.VAR_TYPE],
        'length': person[tc.VAR_LENGTH],
        'width': person[tc.VAR_WIDTH],
        'person': person.get(tc.VAR_VEHICLE),
        'vClass': 'pedestrian',
    }


def vehicle_to_dict(vehicle):
    """Extracts relevant information from traci.vehicle.getSubscriptionResults."""
    if not vehicle:
        return None
        
    pos = vehicle.get(tc.VAR_POSITION3D) or (0, 0, 0)
    return {
        'x': pos[0],
        'y': pos[1],
        'z': pos[2],
        'speed': vehicle.get(tc.VAR_SPEED, 0),
        'angle': vehicle.get(tc.VAR_ANGLE, 0),
        'type': vehicle.get(tc.VAR_TYPE, 'default'),
        'length': vehicle.get(tc.VAR_LENGTH, 5),
        'width': vehicle.get(tc.VAR_WIDTH, 2),
        'signals': vehicle.get(tc.VAR_SIGNALS, 0),
        'vClass': vehicle.get(tc.VAR_VEHICLECLASS) or vehicle.get(0x49, 'passenger'),
        'waiting_time': vehicle.get(tc.VAR_WAITING_TIME, 0),
        'time_loss': vehicle.get(tc.VAR_TIMELOSS, 0),
        'departure': vehicle.get(tc.VAR_DEPARTURE, 0) if hasattr(tc, 'VAR_DEPARTURE') else 0,
    }


def light_to_dict(light):
    """Extract relevant information from traci.trafficlights.getSubscriptionResults."""
    return {
        'phase': light[tc.TL_CURRENT_PHASE],
        'programID': light[tc.TL_CURRENT_PROGRAM],
        'state': light.get(tc.TL_RED_YELLOW_GREEN_STATE, ''),
    }
