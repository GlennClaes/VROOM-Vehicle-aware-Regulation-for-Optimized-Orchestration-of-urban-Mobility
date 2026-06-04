import traci
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SUMO_CFG = BASE_DIR / "scenarios" / "hasselt_xl" / "osm.sumocfg"

traci.start(["sumo", "-c", str(SUMO_CFG)])

for step in range(50):
    traci.simulationStep()

    vehicle_ids = traci.vehicle.getIDList()
    print(f"Step {step}: {len(vehicle_ids)} vehicles")
    for vid in vehicle_ids[:5]:
        pos = traci.vehicle.getPosition(vid)
        speed = traci.vehicle.getSpeed(vid)
        print(f"  Vehicle {vid} at {pos} moving at {speed:.2f} m/s")

    tls_ids = traci.trafficlight.getIDList()
    for tls in tls_ids:
        state = traci.trafficlight.getRedYellowGreenState(tls)
        print(f"  Traffic light {tls} state: {state}")

    if step % 10 == 0:
        for tls in tls_ids:
            phases = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls)[0].phases
            current_phase_index = traci.trafficlight.getPhase(tls)
            new_phase_index = (current_phase_index + 1) % len(phases)
            traci.trafficlight.setPhase(tls, new_phase_index)
            print(f"    → Changed {tls} from phase {current_phase_index} to {new_phase_index}")

traci.close()
print("Simulation finished!")
