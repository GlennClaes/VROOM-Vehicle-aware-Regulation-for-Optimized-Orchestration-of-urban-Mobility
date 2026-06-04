"""
inspect_hasselt.py — Toont alle verkeerslichten en rijstroken in het Hasselt XL scenario
"""

import os
import sys

os.environ.setdefault("SUMO_HOME", r"C:\Program Files (x86)\Eclipse\Sumo")
sys.path.append(os.path.join(os.environ["SUMO_HOME"], "tools"))

import traci # noqa: E402

SUMOCFG = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "scenarios", "hasselt_xl", "osm.sumocfg"
)

sumo_cmd = [
    "sumo",
    "-c", SUMOCFG,
    "--start", "true",
    "--no-step-log",
    "--no-warnings",
]

print("SUMO starten...")
traci.start(sumo_cmd, port=8814, numRetries=60)
print("Verbonden!\n")

# ── Verkeerslichten ───────────────────────────────────────────────────────────
tls_ids = traci.trafficlight.getIDList()
print(f"{'='*60}")
print(f"VERKEERSLICHTEN ({len(tls_ids)} totaal):")
print(f"{'='*60}")
for tls in tls_ids[:20]:  # eerste 20
    links = traci.trafficlight.getControlledLinks(tls)
    print(f"  ID: '{tls}'  ({len(links)} gecontroleerde rijstroken)")

if len(tls_ids) > 20:
    print(f"  ... en nog {len(tls_ids) - 20} meer")

# ── Rijstroken ────────────────────────────────────────────────────────────────
lane_ids = traci.lane.getIDList()
print(f"\n{'='*60}")
print(f"RIJSTROKEN ({len(lane_ids)} totaal) — eerste 30:")
print(f"{'='*60}")
for lane in lane_ids[:30]:
    print(f"  '{lane}'")

# ── Drukste kruispunten zoeken ────────────────────────────────────────────────
print(f"\n{'='*60}")
print("TOP 5 KRUISPUNTEN (meeste gecontroleerde rijstroken):")
print(f"{'='*60}")
tls_sizes = [(tls, len(traci.trafficlight.getControlledLinks(tls))) for tls in tls_ids]
tls_sizes.sort(key=lambda x: x[1], reverse=True)
for tls, count in tls_sizes[:5]:
    links     = traci.trafficlight.getControlledLinks(tls)
    in_lanes  = list(set(link[0][0] for link in links if link))
    phases    = traci.trafficlight.getAllProgramLogics(tls)
    n_phases  = len(phases[0].phases) if phases else 0
    print(f"\n  Kruispunt: '{tls}'")
    print(f"  Rijstroken: {count}  |  Fasen: {n_phases}")

traci.close()
print(f"\n{'='*60}")
print("Kopieer een kruispunt-ID en zijn rijstroken naar sumo_env.py")
print(f"{'='*60}")
