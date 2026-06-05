import traci
import csv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SUMO_CFG = BASE_DIR / "scenarios" / "hasselt_xl" / "osm.sumocfg"

output_file = BASE_DIR / "baseline" / "fixed_time_log.csv"

def run_simulation():
    with open(output_file, "w", newline="") as csvfile:
        fieldnames = ["step", "num_vehicles", "tls_id", "phase", "avg_waiting_time", "avg_queue_length"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        traci.start(["sumo", "-c", str(SUMO_CFG)])

        for step in range(100):
            traci.simulationStep()

            vehicle_ids = traci.vehicle.getIDList()
            num_vehicles = len(vehicle_ids)

            waiting_times = [traci.vehicle.getWaitingTime(vid) for vid in vehicle_ids]
            avg_wait = sum(waiting_times)/len(waiting_times) if waiting_times else 0.0

            lane_ids = traci.lane.getIDList()
            queue_lengths = [traci.lane.getLastStepHaltingNumber(lane) for lane in lane_ids]
            avg_queue = sum(queue_lengths)/len(queue_lengths) if queue_lengths else 0.0

            tls_ids = traci.trafficlight.getIDList()
            for tls in tls_ids:
                current_phase = traci.trafficlight.getPhase(tls)

                writer.writerow({
                    "step": step,
                    "num_vehicles": num_vehicles,
                    "tls_id": tls,
                    "phase": current_phase,
                    "avg_waiting_time": avg_wait,
                    "avg_queue_length": avg_queue
                })

            if step % 10 == 0:
                for tls in tls_ids:
                    phases = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls)[0].phases
                    current_phase = traci.trafficlight.getPhase(tls)
                    new_phase = (current_phase + 1) % len(phases)
                    traci.trafficlight.setPhase(tls, new_phase)

        traci.close()
    print("Fixed-time simulation finished! Logs in:", output_file)

if __name__ == "__main__":
    run_simulation()
