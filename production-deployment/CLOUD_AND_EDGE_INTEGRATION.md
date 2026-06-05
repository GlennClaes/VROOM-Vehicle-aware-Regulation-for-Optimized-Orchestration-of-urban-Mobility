# VROOM Cloud-to-Edge Production Integration Manual

This document provides a guide for field engineers and municipal IT operators to deploy the VROOM Traffic AI stack in a production municipal environment, linking the cloud central server with physical street cabinets.

---

## 1. Network Architecture Topology

To prevent security intrusions into critical road traffic control systems, the server and cabinets must communicate via an isolated virtual private network.

```mermaid
graph TD
    subgraph Municipal Cloud (AWS / Azure)
        NATS[NATS Broker TLS - Port 4222]
        Backend[Backend AI Inference API]
        Frontend[Vue 3 Monitoring Dashboard]
        DB[(MySQL Status Database)]
    end

    subgraph Secure Cellular APN / IPsec VPN
        Tunnel1[IPsec Tunnel / Private APN Route]
    end

    subgraph Edge Cabinet (Kruispunt A)
        EdgeA[C++ vroom-real-controller]
        PLC_A[Modbus PLC / GPIO Relays]
        WatchdogA[/dev/watchdog]
    end

    subgraph Edge Cabinet (Kruispunt B)
        EdgeB[C++ vroom-real-controller]
        PLC_B[Modbus PLC / GPIO Relays]
        WatchdogB[/dev/watchdog]
    end

    EdgeA -->|mTLS Heartbeats / Telemetry| Tunnel1
    EdgeB -->|mTLS Heartbeats / Telemetry| Tunnel1
    Tunnel1 --> NATS
    NATS --> Backend
    Backend --> DB
    Frontend --> Backend
```

### Infrastructure Options
1. **Private Cellular APN (Recommended)**: Provide SIM cards for 4G/5G edge routers in the cabinets that route traffic exclusively through a private Access Point Name (APN) peer-connected to the AWS VPC or Azure VNet.
2. **IPsec VPN Gateway**: Configure the cabinet router to initiate an IPsec VPN tunnel back to the cloud network.

---

## 2. Mutual TLS (mTLS) Security Setup

Verkeerslichten are critical infrastructure. We enforce Mutual TLS (mTLS) where NATS requires both the server and edge clients to authenticate with certificates signed by a trusted Municipal Root Certificate Authority (CA).

### Certificate Generation Script (openssl)
Save and run this script on the central server to generate keys:

```bash
# 1. Generate Root CA
openssl req -x509 -sha256 -nodes -days 3650 -newkey rsa:4096 -keyout ca.key -out ca.crt -subj "/CN=Municipal Traffic Root CA"

# 2. Generate NATS Server Certificate
openssl req -new -nodes -newkey rsa:2048 -keyout server.key -out server.csr -subj "/CN=nats.verkeer.hasselt.be"
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt

# 3. Generate Cabinet Client Certificate (e.g. for hasselt-xl-a)
openssl req -new -nodes -newkey rsa:2048 -keyout cabinet-a.key -out cabinet-a.csr -subj "/CN=hasselt-xl-a.edge"
openssl x509 -req -days 365 -in cabinet-a.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out cabinet-a.crt
```

---

## 3. Physical Hardware Interfaces (PLCs & Relays)

### Option A: Modbus TCP PLC Adapter (Standard Production)
The C++ controller translates NATS command phases to Modbus coils or holding registers of a DIN-rail PLC inside the cabinet.
- **Port**: `502` (Modbus default)
- **Registers Mapping**:
  - `Holding Register 1000` (North-South Signal): `0` = Red, `1` = Amber, `2` = Green.
  - `Holding Register 1001` (East-West Signal): `0` = Red, `1` = Amber, `2` = Green.

### Option B: Linux Sysfs GPIO Relays (Simpler Retrofits)
For cabinet upgrades using microcontrollers or industrial Raspberry Pi gateways, the C++ controller updates physical relays using sysfs GPIO pins:
- **GPIO 17**: North-South Green Relay
- **GPIO 18**: East-West Green Relay
- **GPIO 27**: All-Red / Failsafe Override Relay

---

## 4. Hardware Safety Watchdog

To prevent a software crash or network disconnect from locking the traffic lights in a static green state, the C++ daemon constantly writes to the physical Linux watchdog device `/dev/watchdog`.

If `vroom-real-controller` crashes or misses its ping schedule:
1. The hardware watchdog timer expires.
2. The hardware watchdog disconnects primary green relay lines.
3. The intersection automatically flips back to a **failsafe orange-flashing state** or **all-red** via hardware interlocks.

---

## 5. Verification Commands

Run these on site or in staging to verify cabinet-to-cloud telemetry:

1. **Verify Cloud Connectivity**:
   ```bash
   ping nats.verkeer.hasselt.be
   ```
2. **Launch Controller with Telemetry env**:
   ```bash
   ./vroom-real-controller --config /app/config/config.json
   ```
3. **Inspect telemetry on Central City Hall Dashboard**:
   Go to `http://<server-ip>/dashboard` and inspect the "Live VROOM Edge Telemetry" widget on the left sidebar to confirm online status, latency, and phase synchronization.
