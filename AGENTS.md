# VROOM AI Agent Playbook

Use these agent roles when you want AI help on the production-ready version of VROOM. Each agent should produce concrete findings with file references, severity and suggested fixes. Do not let agents approve safety-critical work without human review.

## 1. Safety Reviewer

Goal: detect traffic-safety risks before code reaches real hardware.

Checklist:

- Conflicting green phases are impossible in controller logic and hardware mapping.
- Lost communication always enters all-red before fallback cycling.
- Unknown phases are rejected.
- GPIO and PLC dry-run defaults cannot accidentally energize live outputs.
- Watchdog and shutdown behavior are documented.
- Timing constants have safe defaults and are configurable.

Prompt:

```text
Review production-real-traffic-lights as a traffic-safety reviewer. Focus on fail-safe behavior, conflicting phases, hardware adapter risks, timing rules and deployment hazards. Return only actionable findings with file references and severity.
```

## 2. C++ Test Generator

Goal: increase confidence in the controller state machine and protocol.

Checklist:

- Add tests for malformed protocol messages.
- Add tests for stale/expired messages.
- Add tests for fallback recovery after a neighbor heartbeat returns.
- Add tests for GPIO/PLC dry-run behavior.
- Keep tests dependency-free unless a clear reason exists.

Prompt:

```text
Generate focused C++ tests for production-real-traffic-lights. Keep the tests dependency-free, use assert-style checks like the existing tests, and cover edge cases in message parsing, fallback transitions and hardware mocks.
```

## 3. Deployment Reviewer

Goal: make sure Docker, compose and environment files are usable by a third party.

Checklist:

- `.env.example` contains every required variable without real secrets.
- Dockerfiles run as non-root where possible.
- Compose services have healthchecks where useful.
- Ports are documented.
- Local commands work on Windows and Linux.

Prompt:

```text
Review the deployment files for VROOM. Focus on Dockerfiles, compose files, .env examples, Makefile targets and README instructions. Identify missing variables, fragile commands and unclear run steps.
```

## 4. Documentation Reviewer

Goal: make the project understandable for a jury, company or future teammate.

Checklist:

- README explains the product, research scope, architecture and real-light extension.
- Docs site uses concrete project evidence, not generic filler.
- Research sources are traceable in `research/SOURCES.md`.
- Production limitations are honest and visible.

Prompt:

```text
Review the VROOM README, docs-site and research/SOURCES.md as final assessment documentation. Flag unclear claims, missing evidence, generated-sounding text and places where screenshots or diagrams would help.
```

## 5. Security Reviewer

Goal: reduce obvious security mistakes before deployment.

Checklist:

- No secrets are committed.
- NATS control commands can be protected with TLS/mTLS.
- Database credentials are examples only.
- Hardware command tools fail clearly when dependencies are missing.
- Public endpoints and control channels are documented separately.

Prompt:

```text
Review VROOM for deployment security risks. Focus on secrets, NATS command integrity, Docker privileges, environment variables, logging of sensitive data and attack paths into physical traffic-light control.
```
