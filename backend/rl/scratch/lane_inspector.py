import os
import sys
import sumolib

SUMO_HOME = os.environ.get('SUMO_HOME', '')
if not SUMO_HOME:
    print("SUMO_HOME not set")
    sys.exit(1)

sys.path.append(os.path.join(SUMO_HOME, 'tools'))

net_path = os.path.abspath('../scenarios/hasselt_xl/osm.net.xml')
print(f"Reading {net_path}")
net = sumolib.net.readNet(net_path)

tl_id = 'joinedS_cluster_192603469_255381549_3903527581_cluster_2385586901_255381611_32904045'
tl = net.getTLS(tl_id)

print(f"Links: {len(tl.getLinks())}")
incoming = set()
outgoing = set()

for link_list in tl.getLinks().values():
    for link in link_list:
        incoming.add(link[0].getID())
        outgoing.add(link[1].getID())

print(f"Incoming ({len(incoming)}): {sorted(list(incoming))}")
print(f"Outgoing ({len(outgoing)}): {sorted(list(outgoing))}")
