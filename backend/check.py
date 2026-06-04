import sumolib, traci, sys
sumoBinary = sumolib.checkBinary("sumo")
traci.start([sumoBinary, "-c", "scenarios/hasselt_xl/osm.sumocfg"])

tls = traci.trafficlight.getIDList()
print("Number of TLS:", len(tls))
if len(tls)>0:
    try:
        pos = traci.junction.getPosition(tls[0])
        print("Junction pos:", pos)
    except Exception as e:
        print("ERROR:", e)
    # What if we get the controlled lanes to find position?
    lanes = traci.trafficlight.getControlledLanes(tls[0])
    if len(lanes)>0:
        try:
            pos = traci.lane.getShape(lanes[0])[-1] # end of lane is at junction
            print("Lane endpoint pos:", pos)
        except Exception as e:
            print("Lane err:", e)

traci.close()
