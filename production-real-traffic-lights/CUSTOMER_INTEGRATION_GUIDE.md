# VROOM Customer Integration & Deployment Guide

This guide describes how to deploy the VROOM (Vehicle-aware Regulation for Optimized Orchestration of urban Mobility) production-ready controllers on real physical intersections. It is designed to help engineers, municipal partners, and integration teams install, configure, and safely connect VROOM to physical hardware.

---

## 1. System Architecture

The VROOM system splits high-level intelligent logic (AI models) from low-level safety-critical hardware controls:

```mermaid
graph TD
    subgraph Central Control/Edge Server (AI Engine)
        AI[D3QN AI Agent / Python Service] -->|Sends Phase Command via NATS| Bus
    end

    subgraph Municipal Network
        Bus[NATS Message Bus / Low-Latency MQTT]
    end

    subgraph Traffic Light Controller Cabinet
        Bus -->|NATS Subscription| Controller[VROOM C++ Controller Binary]
        Controller -->|Valdiates Safety Constraints| HAL[Hardware Abstraction Layer]
        HAL -->|Direct Voltage| Relays[GPIO / Relay Board / PLC]
        Relays -->|Power Lines| PhysicalLights[Traffic Light Signals]
        Controller -->|State Feedback| Bus
    end
    
    style Controller fill:#f96,stroke:#333,stroke-width:2px
    style HAL fill:#9c6,stroke:#333,stroke-width:2px
```

---

## 2. Step 1: Hardware Selection

Depending on the cabinet setup, the VROOM C++ controller can be deployed on different hardware:

| Cabinet Setup | recommended Hardware | HAL Adapter |
|---|---|---|
| **Legacy/Relay Cabinet** | Industrial Raspberry Pi (e.g., Revolution Pi) or DIN-rail PC with GPIO relay cards | `GpioHardwareAdapter` |
| **Industrial / PLC Cabinet** | Siemens S7, Phoenix Contact, or WAGO PLC communicating over Modbus TCP | `PlcHardwareAdapter` |
| **Test Setup / Dry Run** | Any standard Linux/Windows PC | `MockHardwareAdapter` |

---

## 3. Step 2: Configuration Mapping

Create a production config file at `config/intersections.json` (you can copy and modify `config/intersections.example.json`).

### Example: Relays & GPIO Integration
```json
{
  "transport": {
    "framework": "nats",
    "url": "nats://your-nats-server:4222",
    "heartbeat_interval_ms": 500,
    "communication_timeout_ms": 1500
  },
  "intersections": [
    {
      "id": "hasselt-junction-1",
      "adapter": "gpio",
      "dry_run": true,
      "all_red_duration_ms": 2000,
      "pins": [
        { "signal_id": "north_south_green", "color": "green", "pin": 17, "active_high": true },
        { "signal_id": "north_south_amber", "color": "amber", "pin": 27, "active_high": true },
        { "signal_id": "north_south_red", "color": "red", "pin": 22, "active_high": true }
      ]
    }
  ]
}
```

*Note: Keep `"dry_run": true` active during testing. In dry-run mode, the controller simulates switching the pins but only outputs logs instead of sending electrical signals.*

---

## 3.5 Real-Time Congestion & Data Acquisition API

VROOM gathers live telemetry and floating car data from multiple municipal sources to locate traffic jams and dynamically display them on the 3D dashboard for operators.

```
+------------------+     REST API     +-------------------+     Redis     +-------------------+
|  Road Sensors &  | ---------------> |  FastAPI Backend  | ------------> |    Live Cache     |
| Camera Counters  |  (POST /state)   |   & Data Engine   |               |   (Congestion)    |
+------------------+                  +-------------------+               +-------------------+
                                                ^                                   |
+------------------+                            |                                   | GET /network
|   Floating Car   | ---------------------------+                                   v
|   Data (GPS)     |         REST API                                     +-------------------+
+------------------+                                                      | 3D WebGL Frontend |
                                                                          |   (Red Highlights)|
                                                                          +-------------------+
```

### 1. Road Sensors & Loop Detectors
Fysieke detectielussen in het wegdek en camerasystemen sturen via beveiligde REST API-calls continu verkeersgegevens (zoals voertuigtellingen en bezettingsgraden) naar de backend endpoints:
* **Endpoint**: `POST /api/v1/simulations/state` of `/api/v1/metrics`
* **Payload**: Voertuigtellingen per rijstrook, gemiddelde wachtrijlengtes en bezettingstijden.

### 2. Mobile Floating Car Data (FCD)
Externe partijen (zoals GPS-voertuigtelemetrie, Waze, TomTom of lokale mobiliteitsapps) pushen live snelheidsgegevens van actieve auto's op het gemeentelijke netwerk:
* **Endpoint**: `POST /api/v1/simulations/fcd`
* **Payload**: GPS-coördinaten, actuele snelheden en timestamps per anoniem voertuig.

### 3. Backend Processing & Redis Caching
De FastAPI backend verwerkt alle binnenkomende wegsensor- en FCD-telemetrie realtime:
* Het systeem berekent een **Congestie-Index** per weglink.
* Deze berekende file-informatie wordt direct in de Redis-cache opgeslagen met een korte TTL om de belasting op de hoofddatabase te minimaliseren.

### 4. 3D Congestie Visualisatie (Waar is de file?)
Het 3D WebGL-dashboard (gebouwd met Vue 3 en Three.js) haalt elke seconde de actuele netwerkstatus op:
* **Endpoint**: `GET /api/v1/network`
* **Visualisatie-Logica**: Zodra de gemiddelde snelheid op een specifiek wegsegment onder de **15 km/u** zakt, kleurt het wegsegment op de 3D-kaart direct fel **rood**.
* **Verbetering**: Het dashboard is geoptimaliseerd om door middel van helderheid en kleurintensiteit direct aan te tonen waar de zwaarste files en bottlenecks zich bevinden, zodat verkeersleiders direct kunnen ingrijpen of het RL-model prioriteit kan verlenen aan die specifieke assen.

---

## 4. Step 3: Deployment Checklist for Customers

To integrate VROOM at a client's site, follow this step-by-step checklist:

### ⬜ Phase 1: Mock Test
- Run the simulation in mock mode:
  ```bash
  docker compose -f production-real-traffic-lights/docker-compose.prod.yml up --build
  ```
- Send commands via NATS to verify that state switches work correctly in mock outputs.

### ⬜ Phase 2: Cabinet Hardware Setup & Dry Run
- Install the DIN-rail PC or Gateway inside the controller cabinet.
- Connect the relay controls/PLC interface cables.
- Set `"dry_run": true` in configuration.
- Start the controller. Observe the logs to ensure the pin triggers match the expected traffic phases.

### ⬜ Phase 3: Hardware Validation (Relay Testing)
- Set `"dry_run": false`.
- Individually trigger green, amber, and red channels to verify that the correct bulbs light up on the road.
- **CRITICAL**: Confirm that conflicting directions (e.g., North-South Green and East-West Green) can NEVER be electrically active at the same time.

### ⬜ Phase 4: AI Model Integration
- Connect the VROOM RL/AI model output stream to the NATS instance.
- Let the AI control the junction under supervision.

---

## 4.5 Cabinet Commissioning & Testing Tool

To make field deployment easier for installers, VROOM includes a dedicated command-line utility: [cabinet_tester.py](file:///c:/Projecten/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/production-real-traffic-lights/cabinet_tester.py). Installers can run this tool from their laptops inside the cabinet to verify individual connections:

### Test direct Modbus TCP PLC registers:
```bash
# Set register 1000 to value 2 (Green) on a Modbus PLC
python cabinet_tester.py plc --endpoint 192.168.20.10:502 --register 1000 --value 2
```

### Test direct Linux GPIO pins:
```bash
# Force GPIO Pin 17 ON (High) to test relay triggers
python cabinet_tester.py gpio --pin 17 --on
```

### Test full NATS messaging pipeline:
```bash
# Command intersection 'hasselt-xl-a' to switch to phase 3 over NATS
python cabinet_tester.py nats --url nats://localhost:4222 --intersection hasselt-xl-a --phase 3

# With NATS TLS/SSL enabled:
python cabinet_tester.py nats --url nats://localhost:4222 --intersection hasselt-xl-a --phase 3 --ca-cert /path/to/ca.pem --client-cert /path/to/client.pem --client-key /path/to/client-key.pem

# Send an Emergency Vehicle (EV) Preemption priority request (bypasses Minimum Green enforcers):
python cabinet_tester.py nats --url nats://localhost:4222 --intersection hasselt-xl-a --phase EW_GREEN --type PRIORITY
```

---

## 4.6 NATS TLS/SSL Bus Encryption
To protect traffic controllers from malicious command injections or eavesdropping on municipal networks, NATS should be configured with mutual TLS (mTLS). Both the AI agent and the C++ controller cabinets must authenticate with valid certificates.

### Environment variables for C++ Controller:
- `VROOM_NATS_CA_CERT_PATH`: Absolute path to the CA root certificate file.
- `VROOM_NATS_CLIENT_CERT_PATH`: Absolute path to the controller's client certificate file.
- `VROOM_NATS_CLIENT_KEY_PATH`: Absolute path to the controller's private key.

### AI Client connection:
Ensure the central D3QN AI python agent loads the client certificates to publish commands safely.

---

## 4.7 Physical Hardware Watchdog (C++)
To guarantee the junction fails safe if the VROOM controller binary hangs or crashes:
1. The C++ controller opens the Linux watchdog card (usually at `/dev/watchdog`) on start.
2. In its active cycle, it writes a keep-alive character (`\0`) every second.
3. If the process crashes or gets deadlocked, the write stops. The hardware card detects the missing ping and automatically forces the cabinet relays to safety mode (switching traffic signals to flashing amber or disabling power completely).
4. Configure the path using the environment variable:
   `VROOM_WATCHDOG_PATH=/dev/watchdog`

---

## 4.8 GLOSA (Green Light Optimal Speed Advisory) API
Connected vehicles (e.g. Audi/Tesla) or smartphone apps (e.g. Flitsmeister) can consume optimal speed advisories from the open NATS heartbeat topic.

- **NATS Subject**: `vroom.intersections.<intersection-id>.heartbeat`
- **Payload extension**: The 10th pipe-separated field contains the remaining time until the current signal phase changes:
  `VROOM|1|HEARTBEAT|hasselt-xl-a|43|1717423105623|NS_GREEN|ok|1000|4500`
  *(Here, `4500` represents `4500ms` or 4.5 seconds remaining of the green phase).*
- **Optimal Speed Advisory formula**:
  $$v_{adv} = \frac{d}{t_{remaining}}$$
  Where $d$ is distance to the stopline, and $t_{remaining}$ is the GLOSA remaining phase time.

---

## 5. Built-in Safety Fail-Safes

VROOM is built with industry-standard safety mechanisms to prevent accidents:

1. **Lost Link Fallback**: If the NATS network goes down and the controller misses heartbeat messages for more than `communication_timeout_ms` (default: 1.5 seconds), it immediately enters an `ALL_RED` state for safety, then starts a local fixed-time cycle.
2. **Minimum Green Enforcer**: The C++ controller will reject AI phase commands if the current phase has been active for less than the minimum safe green time (default: 6 seconds, configured via `VROOM_MIN_GREEN_DURATION_MS`) to prevent dangerous rapid switching.
3. **Yellow Clearance Enforcer**: When changing phases, the C++ controller autonomously injects a yellow/amber phase (default: 3 seconds, configured via `VROOM_AMBER_DURATION_MS`) to allow clearing of the intersection before turning the conflicting lane green.
4. **Physical Watchdog Link**: Periodically registers keep-alive ticks to `/dev/watchdog` to prevent mechanical freeze on critical hardware interfaces.
