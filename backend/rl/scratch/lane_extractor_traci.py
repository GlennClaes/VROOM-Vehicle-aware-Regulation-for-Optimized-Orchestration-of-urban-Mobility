import os
import sys

SUMO_HOME = os.environ.get("SUMO_HOME", "")
sys.path.append(os.path.join(SUMO_HOME, "tools"))

import traci # noqa: E402
import sumolib # noqa: E402

def get_lanes():
    sumo_binary = sumolib.checkBinary('sumo')
    sumo_cmd = [sumo_binary, '-c', '../scenarios/hasselt_xl/osm.sumocfg', '--no-step-log', 'true', '--no-warnings', 'true']

    traci.start(sumo_cmd)
    tl_id = 'joinedS_cluster_192603469_255381549_3903527581_cluster_2385586901_255381611_32904045'

    # Correct API to get links (controlled links)
    links = traci.trafficlight.getControlledLinks(tl_id)

    incoming = set()
    outgoing = set()

    for link in links:
        for sublink in link:
            if sublink:
                incoming.add(sublink[0])
                outgoing.add(sublink[1])

    print(f"INCOMING_LANES = {sorted(list(incoming))}")
    print(f"OUTGOING_LANES = {sorted(list(outgoing))}")

    traci.close()

if __name__ == "__main__":
    try:
        get_lanes()
    except Exception as e:
        print(f"Error: {e}")
