#!/usr/bin/env python3
"""
download_osm_city.py — Automates downloading a map from OpenStreetMap,
converting it to a SUMO network, generating trip files for all 4 traffic profiles
(Normal, Rush Hour, Quiet, Night), and registering the scenarios in the system.

Usage:
    python scripts/download_osm_city.py --city antwerp
    python scripts/download_osm_city.py --city brussels
    python scripts/download_osm_city.py --city bruges
    python scripts/download_osm_city.py --city leuven
    python scripts/download_osm_city.py --custom 4.33,50.83,4.38,50.87 --name my_custom_city
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import subprocess
from pathlib import Path

# Ensure stdout and stderr use UTF-8 encoding to avoid Windows console errors with unicode emojis
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# --- Configuration Bounds for Belgian Cities (min_lon, min_lat, max_lon, max_lat) ---
CITY_BOUNDS = {
    "brussels": {
        "name": "Brussels Center",
        "city_name": "Brussels",
        "bbox": "4.33,50.83,4.38,50.87"
    },
    "antwerp": {
        "name": "Antwerp Center",
        "city_name": "Antwerp",
        "bbox": "4.37,51.20,4.43,51.23"
    },
    "ghent": {
        "name": "Ghent Center",
        "city_name": "Ghent",
        "bbox": "3.70,51.04,3.76,51.07"
    },
    "gent": {
        "name": "Ghent Center",
        "city_name": "Ghent",
        "bbox": "3.70,51.04,3.76,51.07"
    },
    "bruges": {
        "name": "Bruges Historic Center",
        "city_name": "Bruges",
        "bbox": "3.20,51.19,3.25,51.22"
    },
    "leuven": {
        "name": "Leuven Center",
        "city_name": "Leuven",
        "bbox": "4.68,50.86,4.72,50.89"
    },
    "liege": {
        "name": "Liège Center",
        "city_name": "Liège",
        "bbox": "5.55,50.62,5.60,50.65"
    },
    "namur": {
        "name": "Namur Center",
        "city_name": "Namur",
        "bbox": "4.84,50.45,4.88,50.48"
    },
    "charleroi": {
        "name": "Charleroi Center",
        "city_name": "Charleroi",
        "bbox": "4.42,50.40,4.47,50.43"
    },
    "mechelen": {
        "name": "Mechelen Center",
        "city_name": "Mechelen",
        "bbox": "4.46,51.02,4.50,51.04"
    },
    "hasselt": {
        "name": "Hasselt Center",
        "city_name": "Hasselt",
        "bbox": "5.32,50.92,5.36,50.95"
    }
}

# --- Resolve SUMO_HOME ---
SUMO_HOME = os.environ.get("SUMO_HOME")
if not SUMO_HOME:
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
            SUMO_HOME = path
            break

if not SUMO_HOME:
    print("[ERROR] SUMO_HOME environment variable not found. Please install SUMO first.")
    sys.exit(1)

RANDOM_TRIPS = Path(SUMO_HOME) / "tools" / "randomTrips.py"
if not RANDOM_TRIPS.exists():
    print(f"[ERROR] randomTrips.py tool not found at {RANDOM_TRIPS}")
    sys.exit(1)


def resolve_city_relation_id(city_name: str):
    """
    Queries Nominatim to resolve a city name to its OSM relation ID, formatted name, or bounding box.
    Returns (relation_id, formatted_name, bbox).
    """
    print(f"[OSM] Querying Nominatim to resolve city name: '{city_name}'...")
    
    # We search specifically in Belgium first to be accurate, but support general search as fallback
    for search_query in [f"{city_name}, Belgium", city_name]:
        encoded_query = urllib.parse.quote(search_query)
        url = f"https://nominatim.openstreetmap.org/search?q={encoded_query}&format=json&limit=10"
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'VROOM-Traffic-AI-Importer/1.0')
        
        try:
            with urllib.request.urlopen(req) as response:
                results = json.loads(response.read().decode('utf-8'))
                
            # Filter for administrative boundary relations first
            for r in results:
                if r.get("osm_type") == "relation" and r.get("class") == "boundary":
                    osm_id = r.get("osm_id")
                    display_name = r.get("display_name").split(',')[0].strip()
                    print(f"[OSM] Resolved '{city_name}' to Relation ID: {osm_id} ({display_name})")
                    return str(osm_id), display_name, None
            
            # Fallback: first relation of any kind
            for r in results:
                if r.get("osm_type") == "relation":
                    osm_id = r.get("osm_id")
                    display_name = r.get("display_name").split(',')[0].strip()
                    print(f"[OSM] Resolved '{city_name}' to Relation ID: {osm_id} ({display_name})")
                    return str(osm_id), display_name, None
            
            # Second fallback: use boundingbox of the first result
            if results:
                r = results[0]
                display_name = r.get("display_name").split(',')[0].strip()
                bbox = r.get("boundingbox")
                if bbox and len(bbox) == 4:
                    # Nominatim returns [min_lat, max_lat, min_lon, max_lon]
                    # SUMO expects min_lon,min_lat,max_lon,max_lat
                    sumo_bbox = f"{bbox[2]},{bbox[0]},{bbox[3]},{bbox[1]}"
                    print(f"[OSM] Resolved '{city_name}' to Bounding Box: {sumo_bbox} ({display_name})")
                    return None, display_name, sumo_bbox
        except Exception as e:
            print(f"[WARN] Nominatim search failed for '{search_query}': {e}")
            
    return None, None, None


def download_osm_relation(relation_id: str, output_path: Path):
    """Downloads OSM data within a relation boundary using Overpass API."""
    print(f"[OSM] Querying Overpass API for relation ID: {relation_id}...")
    overpass_query = f"""[out:xml][timeout:180];
relation({relation_id});
map_to_area -> .a;
(
  way(area.a)["highway"];
  node(w);
);
out body;
>;
out skel qt;"""
    
    url = "https://overpass-api.de/api/interpreter"
    data = overpass_query.encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'text/plain')
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    
    try:
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.read())
        print(f"[OSM] Relation download complete! Size: {output_path.stat().st_size / 1024:.0f} KB")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to query Overpass API: {e}")
        return False


def download_osm(bbox: str, output_path: Path):
    """Downloads OSM XML map data for a given bounding box using the Overpass API."""
    # bbox format: min_lon,min_lat,max_lon,max_lat
    # Overpass expects: south,west,north,east = min_lat,min_lon,max_lat,max_lon
    parts = bbox.split(",")
    overpass_bbox = f"{parts[1]},{parts[0]},{parts[3]},{parts[2]}"
    
    overpass_query = f"""[out:xml][timeout:300];
(
  way["highway"]({overpass_bbox});
  node(w);
);
out body;
>;
out skel qt;"""
    
    url = "https://overpass-api.de/api/interpreter"
    data = overpass_query.encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Content-Type', 'text/plain')
    req.add_header('User-Agent', 'VROOM-Traffic-AI-Importer/1.0')
    
    print(f"[OSM] Downloading map data via Overpass API for bbox: {bbox}")
    print(f"[OSM] Saving to {output_path} (this might take a minute)...")
    
    try:
        with urllib.request.urlopen(req) as response:
            with open(output_path, 'wb') as out_file:
                out_file.write(response.read())
        print(f"[OSM] Download complete! Size: {output_path.stat().st_size / 1024:.0f} KB")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to download OSM map: {e}")
        return False
def clean_unsupported_vehicle_classes(net_file_path: Path):
    """Removes vehicle classes that are not supported by SUMO 1.12.0 from the net file for compatibility."""
    supported_classes = {
        "private", "public_emergency", "public_authority", "public_army", 
        "public_transport", "passenger", "hov", "taxi", "bus", "delivery", 
        "truck", "trailer", "tram", "rail_urban", "rail", "rail_electric", 
        "rail_fast", "moped", "motorcycle", "bicycle", "pedestrian", 
        "evehicle", "ship", "custom1", "custom2", "all", "ignoring"
    }
    
    print(f"[SUMO] Cleaning unsupported vehicle classes for SUMO 1.12.0 compatibility...")
    try:
        content = net_file_path.read_text(encoding="utf-8")
        import re
        def replacer(match):
            attr_name = match.group(1)
            classes = match.group(2).split()
            filtered_classes = [c for c in classes if c in supported_classes]
            if not filtered_classes:
                if attr_name == "allow":
                    return 'disallow="all"'
                else:
                    return ''  # Strip empty disallow attributes
            return f'{attr_name}="{" ".join(filtered_classes)}"'
            
        cleaned_content = re.sub(r'\b(allow|disallow)="([^"]*)"', replacer, content)
        net_file_path.write_text(cleaned_content, encoding="utf-8")
        print("  Successfully cleaned unsupported vehicle classes.")
    except Exception as e:
        print(f"  [WARN] Failed to clean unsupported vehicle classes: {e}")


def build_sumo_network(osm_file: Path, net_file: Path):
    """Converts OSM file to SUMO network using netconvert."""
    print(f"[SUMO] Converting {osm_file.name} to SUMO network...")
    
    netconvert_bin = "netconvert"
    cmd = [
        netconvert_bin,
        "--osm-files", str(osm_file),
        "-o", str(net_file),
        "--osm.elevation", "true",
        "--geometry.remove", "true",
        "--ramps.guess", "true",
        "--junctions.join", "true",
        "--tls.guess-signals", "true",
        "--tls.discard-simple", "true",
        "--tls.join", "true"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"[SUMO] Network built successfully: {net_file.name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] netconvert failed:")
        print(e.stderr[:500])
        return False


def generate_scenario_trips(net_file: Path, output_dir: Path, scenario_name: str, period: float):
    """Generates random trips for a specific traffic profile using randomTrips.py."""
    trip_file = output_dir / f"osm.{scenario_name}.trips.xml"
    print(f"[SUMO] Generating trips for '{scenario_name}' (period={period}s)...")
    
    cmd = [
        sys.executable, str(RANDOM_TRIPS),
        "--net-file", str(net_file),
        "--output-trip-file", str(trip_file),
        "--begin", "0",
        "--end", "3600",
        "--period", str(period),
        "--vehicle-class", "passenger",
        "--validate",
        "--random"
    ]
    
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"  ✅ Generated {trip_file.name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Failed to generate trips for {scenario_name}: {e.stderr[:300]}")
        return False


def create_sumocfg(output_dir: Path, scenario_name: str, description: str):
    """Creates the sumocfg configuration file for a scenario."""
    cfg_file = output_dir / f"{scenario_name}.sumocfg"
    
    # Determine net-file based on what's available
    net_file_name = "osm.net.xml.gz" if (output_dir / "osm.net.xml.gz").exists() else "osm.net.xml"
    
    # Build additional-files list
    additional_parts = []
    if (output_dir / "osm.poly.xml.gz").exists():
        additional_parts.append("osm.poly.xml.gz")
    elif (output_dir / "osm.poly.xml").exists():
        additional_parts.append("osm.poly.xml")
    if (output_dir / "output.add.xml").exists():
        additional_parts.append("output.add.xml")
    additional_value = ",".join(additional_parts) if additional_parts else ""
    
    additional_line = ""
    if additional_value:
        additional_line = f'\n        <additional-files value="{additional_value}"/>'
    
    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- {description} -->
<sumoConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/sumoConfiguration.xsd">
    <input>
        <net-file value="{net_file_name}"/>
        <route-files value="osm.{scenario_name}.trips.xml"/>{additional_line}
    </input>
    <processing>
        <ignore-route-errors value="true"/>
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
    print(f"  Created {cfg_file.name}")


def update_scenarios_registry(scenarios_json_path: Path, city_key: str, city_name: str, target_dir_rel: str):
    """Registers the 4 new scenarios in scenarios.json for the frontend."""
    if not scenarios_json_path.exists():
        print(f"[WARN] scenarios.json registry not found at {scenarios_json_path}")
        return

    try:
        with open(scenarios_json_path, 'r') as f:
            scenarios = json.load(f)
    except Exception:
        scenarios = []

    # Filter out any existing entries for this city to prevent duplicates
    scenarios = [s for s in scenarios if s.get("city").lower() != city_name.lower()]

    profiles = [
        {"name": "Normal", "file": "normal.sumocfg", "desc": f"Average traffic in {city_name}"},
        {"name": "Rush Hour", "file": "rush_hour.sumocfg", "desc": f"High traffic in {city_name}"},
        {"name": "Quiet", "file": "quiet.sumocfg", "desc": f"Low traffic in {city_name}"},
        {"name": "Night", "file": "night.sumocfg", "desc": f"Night traffic in {city_name}"}
    ]

    for p in profiles:
        scenarios.append({
            "name": f"{city_name} {p['name']}",
            "city": city_name,
            "description": p["desc"],
            "config_file": f"{target_dir_rel}/{p['file']}",
            "is_default": False,
            "presets": []
        })

    with open(scenarios_json_path, 'w') as f:
        json.dump(scenarios, f, indent=2)
    print(f"[Registry] Successfully registered {city_name} scenarios in {scenarios_json_path.name}")


def main():
    parser = argparse.ArgumentParser(description="Download and compile OSM maps for SUMO.")
    parser.add_argument("--city", help="Preset city key or arbitrary city name to resolve automatically via Nominatim")
    parser.add_argument("--custom", help="Custom bbox coordinates (min_lon,min_lat,max_lon,max_lat)")
    parser.add_argument("--relation", help="OSM Relation ID to download")
    parser.add_argument("--name", help="Custom city name (required if using --custom or --relation)")
    args = parser.parse_args()

    if not args.city and not args.custom and not args.relation:
        print("[ERROR] You must specify either --city, --custom coordinates, or --relation ID.")
        parser.print_help()
        sys.exit(1)

    if (args.custom or args.relation) and not args.name:
        print("[ERROR] --name is required when specifying custom bounding boxes or relation IDs.")
        sys.exit(1)

    city_key = None
    city_name = None
    bbox = None
    use_relation = False
    relation_id = None

    if args.city:
        city_lower = args.city.lower()
        if city_lower in CITY_BOUNDS:
            city_key = city_lower
            city_name = CITY_BOUNDS[city_lower]["city_name"]
            bbox = CITY_BOUNDS[city_lower]["bbox"]
            use_relation = False
        else:
            # Dynamically resolve arbitrary city name via Nominatim API
            resolved_rel_id, resolved_name, resolved_bbox = resolve_city_relation_id(args.city)
            if resolved_rel_id:
                city_key = resolved_name.lower().replace(" ", "_")
                city_name = resolved_name
                relation_id = resolved_rel_id
                use_relation = True
            elif resolved_bbox:
                city_key = resolved_name.lower().replace(" ", "_")
                city_name = resolved_name
                bbox = resolved_bbox
                use_relation = False
            else:
                print(f"[ERROR] Could not resolve city name '{args.city}' via Nominatim. Please provide manual --relation or --custom bounding box.")
                sys.exit(1)
    elif args.relation:
        city_key = args.name.lower().replace(" ", "_")
        city_name = args.name
        relation_id = args.relation
        use_relation = True
    else:
        city_key = args.name.lower().replace(" ", "_")
        city_name = args.name
        bbox = args.custom
        use_relation = False

    # --- Directory Paths ---
    project_root = Path(__file__).parent.parent.resolve()
    
    # 1. Target scenario directory in backend
    backend_scenarios_dir = project_root / "backend" / "scenarios" / city_key
    backend_scenarios_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Target scenario directory in sumo-web3d (web viewer)
    web_scenarios_dir = project_root / "sumo-web3d" / "sumo_web3d" / "scenarios" / city_key
    web_scenarios_dir.mkdir(parents=True, exist_ok=True)

    osm_file = backend_scenarios_dir / "osm_bbox.osm.xml"
    net_file = backend_scenarios_dir / "osm.net.xml"

    # Step 1: Download map
    if use_relation:
        if not download_osm_relation(relation_id, osm_file):
            sys.exit(1)
    else:
        if not download_osm(bbox, osm_file):
            sys.exit(1)

    # Step 2: Compile SUMO Network
    if not build_sumo_network(osm_file, net_file):
        sys.exit(1)

    # Clean unsupported vehicle classes for compatibility with older SUMO versions
    clean_unsupported_vehicle_classes(net_file)

    # Step 2b: Gzip the network file for Docker compatibility
    import gzip as gzip_mod
    import shutil
    net_file_gz = backend_scenarios_dir / "osm.net.xml.gz"
    print(f"[SUMO] Compressing {net_file.name} -> {net_file_gz.name}...")
    with open(net_file, 'rb') as f_in:
        with gzip_mod.open(net_file_gz, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    print(f"  Compressed: {net_file_gz.stat().st_size / 1024:.0f} KB")

    # Step 2c: Create output.add.xml for edge data collection
    output_add = backend_scenarios_dir / "output.add.xml"
    output_add.write_text("""<?xml version="1.0" encoding="UTF-8"?>
<additional>
    <edgeData id="edgeData_0" file="edgeData.xml" freq="300"/>
</additional>""", encoding="utf-8")
    print("  Created output.add.xml")

    # Step 2d: Create osm.view.xml for GUI settings
    view_file = backend_scenarios_dir / "osm.view.xml"
    view_file.write_text("""<viewsettings>
    <viewport zoom="100" x="0" y="0"/>
    <scheme name="real world"/>
</viewsettings>""", encoding="utf-8")
    print("  Created osm.view.xml")

    # Step 2e: Generate polygons (buildings, water) using polyconvert
    poly_file = backend_scenarios_dir / "osm.poly.xml"
    poly_file_gz = backend_scenarios_dir / "osm.poly.xml.gz"
    try:
        type_file = Path(SUMO_HOME) / "data" / "typemap" / "osmPolyconvert.typ.xml"
        if type_file.exists():
            poly_cmd = [
                "polyconvert",
                "--osm-files", str(osm_file),
                "--net-file", str(net_file),
                "-o", str(poly_file),
                "--type-file", str(type_file)
            ]
            subprocess.run(poly_cmd, capture_output=True, text=True, check=True)
            # Gzip the poly file
            with open(poly_file, 'rb') as f_in:
                with gzip_mod.open(poly_file_gz, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            print(f"  Generated osm.poly.xml.gz ({poly_file_gz.stat().st_size / 1024:.0f} KB)")
        else:
            print("  [SKIP] polyconvert type file not found, skipping polygon generation")
    except Exception as e:
        print(f"  [WARN] polyconvert failed (non-critical): {e}")

    # Gzip the OSM source file too
    osm_file_gz = backend_scenarios_dir / "osm_bbox.osm.xml.gz"
    print(f"[SUMO] Compressing {osm_file.name}...")
    with open(osm_file, 'rb') as f_in:
        with gzip_mod.open(osm_file_gz, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

    # Step 3: Generate traffic profiles (trips and configurations)
    profiles = [
        {"name": "rush_hour", "period": 0.5, "desc": "Rush Hour traffic profile"},
        {"name": "normal", "period": 1.0, "desc": "Normal traffic profile"},
        {"name": "quiet", "period": 3.0, "desc": "Quiet traffic profile"},
        {"name": "night", "period": 8.0, "desc": "Night traffic profile"}
    ]

    for p in profiles:
        generate_scenario_trips(net_file, backend_scenarios_dir, p["name"], p["period"])
        create_sumocfg(backend_scenarios_dir, p["name"], p["desc"])

    # Step 4: Sync files to sumo-web3d directory so the web app has direct access
    print("[Sync] Syncing files to web scenario directory...")
    for f in backend_scenarios_dir.glob("*"):
        if f.is_file():
            shutil_dest = web_scenarios_dir / f.name
            try:
                import shutil
                shutil.copy2(f, shutil_dest)
            except Exception as e:
                print(f"[WARN] Failed to copy {f.name}: {e}")

    # Step 5: Update the scenarios registry
    scenarios_json_path = project_root / "sumo-web3d" / "sumo_web3d" / "scenarios.json"
    update_scenarios_registry(scenarios_json_path, city_key, city_name, f"../scenarios/{city_key}")

    print("\n" + "=" * 60)
    print(f"🎉 City '{city_name}' is fully imported and ready to run!")
    print("=" * 60)
    print("Next steps:")
    print(f"1. Run 'bash vroom.sh' or 'make dev' to start the application.")
    print(f"2. Select the new scenario '{city_name} Normal' from the web dashboard dropdown.")


if __name__ == "__main__":
    main()
