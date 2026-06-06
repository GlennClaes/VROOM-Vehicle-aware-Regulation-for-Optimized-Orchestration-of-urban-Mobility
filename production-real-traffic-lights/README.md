# VROOM Production Real Traffic Lights

This folder prepares VROOM for physical traffic-light controllers. The existing Python/RL stack stays responsible for research, simulation, training and dashboard integration. This module adds the production-facing controller layer that can run next to real junction hardware.

## Why C++

C++17 is used for the controller because real traffic-light hardware needs predictable latency, explicit resource ownership, direct hardware SDK integration and a small runtime footprint. The current code avoids external runtime dependencies so it can be compiled for industrial Linux gateways, embedded computers, controller cabinets or CI test runners. A C ABI can be added later when a microcontroller firmware project needs to call the same safety logic.

## Structure

```text
production-real-traffic-lights/
|-- CMakeLists.txt
|-- include/vroom/              # Public controller, HAL and protocol contracts
|-- src/                        # Controller, adapters, logging and demo entrypoint
|-- tests/                      # Dependency-free C++ tests
|-- config/                     # Example field configuration
|-- docs/                       # Safety and protocol documentation
|-- docker/                     # Dockerfile.dev and Dockerfile.prod
|-- scripts/                    # Local Windows/Linux test runners
|-- docker-compose.dev.yml      # Controller + NATS development smoke stack
|-- docker-compose.prod.yml     # Controller + NATS production-style smoke stack
|-- cabinet_tester.py           # Commissioning & hardware testing script (Python)
|-- CUSTOMER_INTEGRATION_GUIDE.md # Customer deployment & safety blueprint
`-- .env.example
```

## Hardware Abstraction Layer

The controller only talks to `HardwareAdapter`. This keeps hardware-specific code isolated:

| Adapter | Purpose |
| --- | --- |
| `MockHardwareAdapter` | Runs tests and demos without physical hardware. |
| `GpioHardwareAdapter` | Controls relay outputs through GPIO-style pin mappings. In dry-run mode it logs writes; in field mode it writes Linux GPIO values. |
| `PlcHardwareAdapter` | Prepared for PLC/Modbus/vendor-SDK integration while keeping the core controller independent from one specific vendor library. |

## Communication

Intersections exchange compact state, intent and heartbeat messages. The recommended transport is NATS because it is low-latency, supports pub/sub and request/reply, has clustering support, and can be deployed as a small edge service. The message format itself is transport-neutral and documented in [docs/PROTOCOL.md](docs/PROTOCOL.md).

Fallback behavior is built into the controller:

1. Missing neighbor heartbeat beyond `communication_timeout_ms` marks communication as lost.
2. The junction enters `ALL_RED` for `all_red_duration_ms`.
3. It switches to a local fixed-time cycle until communication is restored.

## Build Locally

```bash
cmake -S production-real-traffic-lights -B production-real-traffic-lights/build
cmake --build production-real-traffic-lights/build
ctest --test-dir production-real-traffic-lights/build --output-on-failure
```

Run one mocked controller tick:

```bash
production-real-traffic-lights/build/vroom-real-controller --once
```

One-command test runners are available:

```powershell
production-real-traffic-lights\scripts\test-local.ps1
production-real-traffic-lights\scripts\test-local.ps1 -DockerOnly
```

```bash
sh production-real-traffic-lights/scripts/test-local.sh
sh production-real-traffic-lights/scripts/test-local.sh --docker-only
```

More details are documented in [docs/TESTING.md](docs/TESTING.md).

## Docker

```bash
docker compose -f production-real-traffic-lights/docker-compose.prod.yml up --build
```

This starts:

| Service | Purpose |
| --- | --- |
| `nats` | Low-latency communication bus for controller messages. |
| `intersection-a` | Mocked real-light controller for junction A. |
| `intersection-b` | Mocked real-light controller for junction B. |

For the full VROOM stack with dashboard, backend, SUMO simulation, Redis, MySQL, NATS and mocked real-light controllers, use the root-level `docker-compose.production-real.yml`.

## Config Validation and CI

- `config/intersections.schema.json` documents the expected JSON configuration shape.
- `tests/validate_config.py` validates `config/intersections.example.json` without external Python dependencies.
- `.github/workflows/real-traffic-lights-ci.yml` builds the controller, runs `ctest`, validates compose files, and smoke-tests the Docker image on every relevant PR/push.
- The root [AGENTS.md](../AGENTS.md) contains AI-agent review roles for safety, C++ tests, deployment, documentation and security.

## Cabinet Testing & Commissioning

For field installation and verification, use the `cabinet_tester.py` CLI script:

- Direct Modbus PLC write: `python cabinet_tester.py plc --endpoint 192.168.20.10:502 --register 1000 --value 2`
- Direct GPIO pin toggle: `python cabinet_tester.py gpio --pin 17 --on`
- Full-pipeline NATS command: `python cabinet_tester.py nats --url nats://localhost:4222 --intersection hasselt-xl-a --phase 3`

For detailed step-by-step instructions on field deployments and safety rules, check [CUSTOMER_INTEGRATION_GUIDE.md](CUSTOMER_INTEGRATION_GUIDE.md).

## Field Deployment Notes

- Keep `dry_run=true` until relay boards, cabinets and fail-safe wiring have been verified by a qualified engineer.
- Map every signal head and color channel in `config/intersections.example.json`.
- PLC deployments should link a certified Modbus/PLC SDK behind `PlcHardwareAdapter`.
- **Physical Linux Watchdog**: Configure `VROOM_WATCHDOG_PATH=/dev/watchdog` to continuously write ticks and trigger a fail-safe state (relay cut or amber flash) if the controller crashes.
- **NATS SSL/TLS Encryption**: Protect control command integrity by specifying `VROOM_NATS_CA_CERT_PATH`, `VROOM_NATS_CLIENT_CERT_PATH`, and `VROOM_NATS_CLIENT_KEY_PATH` to enforce mutual authentication.
- **Safety Clearance Timings**: Adjust `VROOM_MIN_GREEN_DURATION_MS` (default `6000`) and `VROOM_AMBER_DURATION_MS` (default `3000`) to match municipal standards.
- Final road deployment needs electrical validation, regulatory approval and site-specific safety testing.
