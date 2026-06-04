import os
import sys
import traci

SPAWN_EDGE = "116795271#2" # PXL Elfde Linie
DESTINATION_EDGE = "-1245776180#1" # Dusartplein
VEHICLE_ID = "manual_car_"
ROUTE_ID = "manual_route"
DELAY_MS = 50  # Delay in milliseconds for the GUI to update
NUM_VEHICLES = 0  # Number of vehicles to spawn

if 'SUMO_HOME' in os.environ:
    sys.path.append(os.path.join(os.environ['SUMO_HOME'], 'tools'))
else:
    sys.exit("Please declare 'SUMO_HOME'")

sumo_cfg = "osm.sumocfg"
sumo_cmd = ["sumo-gui",
            "-c", sumo_cfg, # Load the specified SUMO configuration file
            "--start", "true",  # Start the simulation immediately
            "--delay", str(DELAY_MS), # Set a delay to allow the GUI to update
            "--time-to-teleport", "-1"]  # Disable teleporting for stuck vehicles

def create_route():
    traci.route.add(ROUTE_ID, [SPAWN_EDGE, DESTINATION_EDGE])

def spawn():
    global NUM_VEHICLES
    vehicle_id = f"{VEHICLE_ID}{NUM_VEHICLES}"
    NUM_VEHICLES += 1

    # Add a vehicle
    traci.vehicle.add(vehicle_id, ROUTE_ID, typeID="veh_passenger")
    traci.vehicle.setColor(vehicle_id, (0, 255, 255, 255))
    print(f"Vehicle {vehicle_id} successfully spawned on {SPAWN_EDGE}!")
    return vehicle_id

def track(vehicle_id):
    # Track the vehicle in the GUI
    traci.gui.trackVehicle("View #0", vehicle_id)
    traci.gui.setZoom("View #0", 5000)  # Zoom in for better visibility

def run_osm_sim():
    traci.start(sumo_cmd)
    traci.gui.setSchema("View #0", "real world")

    create_route()
    first_car_id = spawn()  # Spawn the first vehicle
    track(first_car_id)  # Track the first vehicle in the GUI

    while traci.simulation.getMinExpectedNumber() > 0:
        traci.simulationStep()

    traci.close()

if __name__ == "__main__":
    run_osm_sim()
