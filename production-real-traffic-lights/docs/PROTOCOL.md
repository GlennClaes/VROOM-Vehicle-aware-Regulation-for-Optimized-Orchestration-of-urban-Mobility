# VROOM Real-Light Message Protocol

The controller protocol is intentionally compact and line-delimited so it can be logged, replayed and validated without a heavy parser. It can run over NATS subjects, TCP streams, serial links or a PLC gateway.

Recommended production transport: **NATS**.

Reason: NATS provides low-latency pub/sub, request/reply patterns, simple clustering, health endpoints and lightweight edge deployment. For municipal PLC environments, a NATS-to-MQTT or NATS-to-PLC bridge can be added without changing controller safety logic.

## Wire Format

```text
VROOM|1|TYPE|intersection_id|sequence|timestamp_ms|phase|health|ttl_ms|[glosa_time_to_change_ms]
```

| Field | Example | Meaning |
| --- | --- | --- |
| `VROOM` | `VROOM` | Protocol marker. |
| `1` | `1` | Protocol version. |
| `TYPE` | `HEARTBEAT` | One of `HEARTBEAT`, `STATE`, `INTENT`, `COMMAND`, `ACK`. |
| `intersection_id` | `hasselt-xl-a` | Unique controller or junction identifier. |
| `sequence` | `42` | Monotonic sender sequence number. |
| `timestamp_ms` | `1717423105123` | Sender timestamp in Unix milliseconds. |
| `phase` | `NS_GREEN` | Current, intended or commanded phase. |
| `health` | `ok` | Sender health state or command status. |
| `ttl_ms` | `1000` | Time-to-live for the message. |
| `glosa_time_to_change_ms` | `4500` | (Optional, Version 1.1) Green Light Optimal Speed Advisory. Milliseconds remaining until the current state changes. |

Example (Standard 9-field format):

```text
VROOM|1|STATE|hasselt-xl-a|42|1717423105123|NS_GREEN|ok|1000
```

Example (Extended 10-field GLOSA format):

```text
VROOM|1|HEARTBEAT|hasselt-xl-a|43|1717423105623|NS_GREEN|ok|1000|4500
```

## Suggested NATS Subjects

| Subject | Publisher | Payload |
| --- | --- | --- |
| `vroom.intersections.*.heartbeat` | Every controller | `HEARTBEAT` |
| `vroom.intersections.*.state` | Every controller | `STATE` |
| `vroom.intersections.*.intent` | Neighboring controllers or SAM AI | `INTENT` |
| `vroom.intersections.*.command` | Backend/SAM AI control service | `COMMAND` |
| `vroom.intersections.*.ack` | Controller receiving a command | `ACK` |

## Reliability Rules

- Drop messages with an invalid protocol marker, unsupported version or expired TTL.
- Treat missing heartbeats beyond `communication_timeout_ms` as communication loss.
- Enter local fallback before accepting any new remote command after a lost-link event.
- Use monotonic sequence numbers per sender and ignore stale messages.
- Log every command that changes physical output state.
