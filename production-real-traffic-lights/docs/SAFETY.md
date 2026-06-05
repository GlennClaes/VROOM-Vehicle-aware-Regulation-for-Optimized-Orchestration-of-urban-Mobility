# Safety Model

This module is a production preparation layer, not a certified road-side controller by itself. It is designed so certified hardware, watchdog relays and site-specific traffic engineering rules can be added without rewriting the core architecture.

## Default Safe States

| Situation | Controller behavior |
| --- | --- |
| Startup | Initialize hardware, then apply `ALL_RED`. |
| Unknown phase | Reject the command and keep the current safe phase. |
| Hardware write failure | Report failure and stop the phase transition. |
| Lost communication | Apply `ALL_RED`, then continue with a local fixed-time fallback cycle. |
| Process shutdown | Ask the hardware adapter to disable outputs or move to safe state. |

## Production Checklist

- Electrical cabinet has independent interlocks that prevent conflicting green phases.
- Hardware watchdog forces red/off when the process or controller gateway stops.
- Signal-head mappings are reviewed by two people before deployment.
- PLC/GPIO writes are tested with dry-run logs before connecting live outputs.
- Emergency vehicle and pedestrian priority rules are validated for the site.
- Logs are shipped to a central system and kept for incident analysis.
- Deployment uses least-privilege OS users and no secrets in source control.

## Current Implementation Scope

- Implemented: HAL contracts, mocks, GPIO dry-run/field write path, PLC integration boundary, protocol parser, fallback state machine and tests.
- Prepared: NATS-based transport, field configuration files and Docker packaging.
- Still site-specific: certified PLC SDK binding, cabinet wiring, local regulation rules, emergency overrides and acceptance tests with real hardware.
