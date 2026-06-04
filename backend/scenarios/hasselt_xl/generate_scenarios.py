"""
DIT SCRIPT IS NIET MEER NODIG — ALLE SCENARIO'S ZIJN AANWEZIG IN DE REPO
GEBRUIK ALLEEN ALS JE NOG SCENARIO'S WILT GENEREREN OF AANPASSEN
ALS JE SCENARIO'S WILT GENEREREN OF AANPASSEN, VERWIJDER DAN DE SUMOCFG EN TRIPS BESTANDEN (niet de osm.sumocfg of osm.passangers.trips.xml)

generate_scenarios.py — Genereert automatisch alle scenario trip files

Voer uit vanuit die map:
    python generate_scenarios.py

Dit maakt automatisch 4 scenario trip files aan:
    osm.rush_hour.trips.xml      (spitsuur)
    osm.normal.trips.xml         (normaal — kopie van huidig)
    osm.quiet.trips.xml          (rustig)
    osm.night.trips.xml          (nacht)

En 4 bijhorende .sumocfg bestanden:
    rush_hour.sumocfg
    normal.sumocfg
    quiet.sumocfg
    night.sumocfg
"""

import os
import sys
import subprocess
from pathlib import Path

# ── Paden ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
NET_FILE   = SCRIPT_DIR / "osm.net.xml.gz"

# ── SUMO_HOME instellen ───────────────────────────────────────────────────────
if not os.environ.get("SUMO_HOME"):
    candidates = [
        r"C:\Program Files (x86)\Eclipse\Sumo",
        r"C:\Program Files\Eclipse\Sumo",
        r"C:\sumo",
        "/usr/share/sumo",
        "/opt/homebrew/opt/sumo",
    ]
    for path in candidates:
        if os.path.exists(path):
            os.environ["SUMO_HOME"] = path
            print(f"[INFO] SUMO_HOME: {path}")
            break

if not os.environ.get("SUMO_HOME"):
    print("FOUT: SUMO_HOME niet gevonden.")
    sys.exit(1)

RANDOM_TRIPS = Path(os.environ["SUMO_HOME"]) / "tools" / "randomTrips.py"
if not RANDOM_TRIPS.exists():
    print(f"FOUT: randomTrips.py niet gevonden op {RANDOM_TRIPS}")
    sys.exit(1)


# ── Scenario definities ───────────────────────────────────────────────────────
SCENARIOS = [
    {
        "name":        "rush_hour",
        "label":       "Spitsuur",
        "period":      0.5,    # elke 0.5s een voertuig → veel verkeer
        "begin":       0,
        "end":         3600,
        "description": "Spitsuur: hoge verkeersdrukte (2x meer dan normaal)",
    },
    {
        "name":        "normal",
        "label":       "Normaal",
        "period":      1.0,    # elke 1s een voertuig → standaard
        "begin":       0,
        "end":         3600,
        "description": "Normaal verkeer: standaard verkeersdruk",
    },
    {
        "name":        "quiet",
        "label":       "Rustig",
        "period":      3.0,    # elke 3s een voertuig → weinig verkeer
        "begin":       0,
        "end":         3600,
        "description": "Rustig verkeer: lage verkeersdruk (3x minder dan normaal)",
    },
    {
        "name":        "night",
        "label":       "Nacht",
        "period":      8.0,    # elke 8s een voertuig → zeer weinig
        "begin":       0,
        "end":         3600,
        "description": "Nachtverkeer: minimale verkeersdruk",
    },
]


# ── Trip files genereren ──────────────────────────────────────────────────────

def generate_trips(scenario: dict) -> bool:
    """Genereert een trip file voor het gegeven scenario."""
    output_file = SCRIPT_DIR / f"osm.{scenario['name']}.trips.xml"

    print(f"\n[{scenario['label']}] Trip file genereren (period={scenario['period']}s)...")

    cmd = [
        sys.executable, str(RANDOM_TRIPS),
        "--net-file",    str(NET_FILE),
        "--output-trip-file", str(output_file),
        "--begin",       str(scenario["begin"]),
        "--end",         str(scenario["end"]),
        "--period",      str(scenario["period"]),
        "--vehicle-class", "passenger",
        "--validate",    # controleer of routes geldig zijn
        "--random",      # willekeurige seed
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        size = output_file.stat().st_size / 1024
        print(f"  ✅ {output_file.name} aangemaakt ({size:.0f} KB)")
        return True
    else:
        print(f"  ❌ Fout: {result.stderr[:200]}")
        return False


# ── sumocfg bestanden aanmaken ────────────────────────────────────────────────

def generate_sumocfg(scenario: dict):
    """Maakt een .sumocfg bestand aan voor het scenario."""
    cfg_file = SCRIPT_DIR / f"{scenario['name']}.sumocfg"

    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- {scenario['description']} -->
<sumoConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/sumoConfiguration.xsd">
    <input>
        <net-file value="osm.net.xml.gz"/>
        <route-files value="osm.{scenario['name']}.trips.xml"/>
        <additional-files value="osm.poly.xml.gz,output.add.xml"/>
    </input>
    <output>
        <tripinfo-output value="tripinfos_{scenario['name']}.xml"/>
        <statistic-output value="stats_{scenario['name']}.xml"/>
    </output>
    <processing>
        <ignore-route-errors value="true"/>
        <tls.actuated.jam-threshold value="30"/>
    </processing>
    <routing>
        <device.rerouting.adaptation-steps value="18"/>
        <device.rerouting.adaptation-interval value="10"/>
    </routing>
    <report>
        <verbose value="true"/>
        <duration-log.statistics value="true"/>
        <no-step-log value="true"/>
    </report>
    <gui_only>
        <gui-settings-file value="osm.view.xml"/>
    </gui_only>
</sumoConfiguration>"""

    cfg_file.write_text(content, encoding="utf-8")
    print(f"  ✅ {cfg_file.name} aangemaakt")


# ── Hoofdprogramma ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Scenario generator — Hasselt XL")
    print("=" * 60)

    if not NET_FILE.exists():
        print(f"FOUT: Netwerk niet gevonden: {NET_FILE}")
        sys.exit(1)

    success_count = 0
    for scenario in SCENARIOS:
        ok = generate_trips(scenario)
        if ok:
            generate_sumocfg(scenario)
            success_count += 1

    print(f"\n{'='*60}")
    print(f"✅ {success_count}/{len(SCENARIOS)} scenarios aangemaakt!")
    print(f"{'='*60}")
    print("\nAangemaakte bestanden:")
    for s in SCENARIOS:
        print(f"  {s['name']}.sumocfg  ({s['description']})")

    print("\nGebruik in train_local.py:")
    print("  Pas SUMOCFG aan naar het gewenste scenario, bijv:")
    print("  SUMOCFG = SCRIPT_DIR.parent / 'scenarios' / 'hasselt_xl' / 'rush_hour.sumocfg'")


if __name__ == "__main__":
    main()
