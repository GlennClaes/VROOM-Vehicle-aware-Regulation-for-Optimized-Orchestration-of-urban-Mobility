# Safety Model

This module is a production preparation layer, not a certified road-side controller by itself. It is designed so certified hardware, watchdog relays and site-specific traffic engineering rules can be added without rewriting the core architecture.

## Default Safe States

| Situation | Controller behavior |
| --- | --- |
| Startup | Initialize hardware, then apply `ALL_RED`. |
| Unknown phase | Reject the command and keep the current safe phase. |
| Hardware write failure | Report failure and stop the phase transition. |
| Lost communication | Apply `ALL_RED`, then continue with a local fixed-time fallback cycle. |
| Rapid phase switching | **Minimum Green Enforcer**: Rejects external phase commands if the active green has been on for less than `min_green_duration_ms` (default 6s). |
| Direct conflicting Green command | **Yellow/Amber Clearance Enforcer**: Intercepts command to conflicting phase and transitions through Amber state (`amber_duration_ms`) and All-Red clearing state first. |
| Process crash/freeze | **Physical Linux Watchdog**: Periodic writes (`/dev/watchdog`) stop, causing the hardware cabinet card to cut power or switch to amber flashing. |
| Process shutdown | Ask the hardware adapter to disable outputs or move to safe state, then write magic character 'V' to gracefully close the watchdog. |

## Production Checklist

- Electrical cabinet has independent interlocks that prevent conflicting green phases.
- Physical Linux Watchdog is configured (`VROOM_WATCHDOG_PATH=/dev/watchdog`) and verified to force safety relays open when the process crashes or is killed.
- Minimum green and clearance amber parameters are tailored for local pedestrian/traffic speeds.
- Signal-head mappings are reviewed by two people before deployment.
- PLC/GPIO writes are tested with dry-run logs before connecting live outputs.
- Emergency vehicle and pedestrian priority rules are validated for the site.
- Logs are shipped to a central system and kept for incident analysis.
- Deployment uses least-privilege OS users and no secrets in source control.

## Current Implementation Scope

- Implemented: HAL contracts, mocks, GPIO dry-run/field write path, PLC integration boundary, protocol parser, fallback state machine, Minimum Green Enforcer, Yellow Clearance Enforcer, Linux hardware watchdog interface and tests.
- Prepared: NATS-based transport, field configuration files, TLS/SSL certificate integration paths, and Docker packaging.
- Still site-specific: certified PLC SDK binding, cabinet wiring, local regulation rules, emergency overrides and acceptance tests with real hardware.
