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
|-- docker/                     # Production Dockerfile
|-- docker-compose.yml          # Controller + NATS local production simulation
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

## Docker

```bash
docker compose -f production-real-traffic-lights/docker-compose.yml up --build
```

This starts:

| Service | Purpose |
| --- | --- |
| `nats` | Low-latency communication bus for controller messages. |
| `intersection-a` | Mocked real-light controller for junction A. |
| `intersection-b` | Mocked real-light controller for junction B. |

For the full VROOM stack with dashboard, backend, SUMO simulation, Redis, MySQL, NATS and mocked real-light controllers, use the root-level `docker-compose.production-real.yml`.

## Field Deployment Notes

- Keep `dry_run=true` until relay boards, cabinets and fail-safe wiring have been verified by a qualified engineer.
- Map every signal head and color channel in `config/intersections.example.json`.
- PLC deployments should link a certified Modbus/PLC SDK behind `PlcHardwareAdapter`.
- Hardware watchdogs should cut outputs to red/off when the process exits unexpectedly.
- Final road deployment needs electrical validation, regulatory approval and site-specific safety testing.
