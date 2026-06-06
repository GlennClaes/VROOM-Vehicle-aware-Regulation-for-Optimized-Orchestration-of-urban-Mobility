# Testing the Real Traffic-Light Controller

This page explains how to test the C++ production-preparation layer without physical traffic-light hardware.

## Fastest Test With Docker

```bash
docker build \
  -f production-real-traffic-lights/docker/Dockerfile.prod \
  -t vroom-real-traffic-controller:local-check \
  production-real-traffic-lights

docker run --rm vroom-real-traffic-controller:local-check --once
```

Expected smoke-test output contains a heartbeat like:

```text
VROOM|1|HEARTBEAT|hasselt-xl-a|1|...|ALL_RED|ok|1000
```

The Docker build also runs CMake, compiles the C++ controller and executes `ctest`.

## Native Test

Install CMake and a C++17 compiler, then run:

```bash
cmake -S production-real-traffic-lights -B production-real-traffic-lights/build -DCMAKE_BUILD_TYPE=Release
cmake --build production-real-traffic-lights/build
ctest --test-dir production-real-traffic-lights/build --output-on-failure
production-real-traffic-lights/build/vroom-real-controller --once
```

On Windows, the binary path is usually:

```powershell
production-real-traffic-lights\build\vroom-real-controller.exe --once
```

## One-Command Scripts

Windows:

```powershell
production-real-traffic-lights\scripts\test-local.ps1
```

Linux/macOS:

```bash
sh production-real-traffic-lights/scripts/test-local.sh
```

Useful flags:

| Flag | Meaning |
| --- | --- |
| `--skip-docker` | Run native CMake/tests only. |
| `--docker-only` | Run Docker build/smoke/compose validation only. |

## Config Validation

Validate the example intersection config:

```bash
python production-real-traffic-lights/tests/validate_config.py \
  production-real-traffic-lights/config/intersections.example.json
```

The schema contract is documented in `production-real-traffic-lights/config/intersections.schema.json`.

## What Is Covered

| Check | Coverage |
| --- | --- |
| `test_protocol` | Encodes/decodes VROOM wire messages and rejects invalid input. |
| `test_controller` | Starts the controller, applies phases, detects lost communication and verifies fallback recovery. |
| Docker build | Proves the production image can compile and pass tests in a clean Alpine environment. |
| Binary smoke test | Proves the compiled controller can start in mock mode and emit a heartbeat. |
| Config validator | Catches invalid transport, adapter, GPIO and PLC mappings before deployment. |

## Next Test Upgrades

- Add command-subscription tests once the C++ controller has a real NATS client implementation.
- Add hardware-in-the-loop tests for the chosen relay board or PLC.
- Add timing tests for minimum green, amber clearance and all-red clearance rules.
- Add mutation/fuzz tests for malformed controller messages.
