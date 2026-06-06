#!/usr/bin/env python3
"""Validate VROOM real-light JSON configuration without external packages."""

from __future__ import annotations

import json
import sys
from pathlib import Path


VALID_ADAPTERS = {"mock", "gpio", "plc"}
VALID_COLORS = {"red", "amber", "green", "off"}
VALID_GROUPS = {"north_south", "east_west"}


def fail(message: str) -> None:
    raise ValueError(message)


def require_int_range(value: object, name: str, minimum: int, maximum: int) -> None:
    if not isinstance(value, int) or not minimum <= value <= maximum:
        fail(f"{name} must be an integer between {minimum} and {maximum}")


def require_string(value: object, name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        fail(f"{name} must be a non-empty string")


def validate_transport(config: dict) -> None:
    transport = config.get("transport")
    if not isinstance(transport, dict):
        fail("transport must be an object")

    if transport.get("framework") != "nats":
        fail("transport.framework must be 'nats'")
    require_string(transport.get("url"), "transport.url")
    require_int_range(transport.get("heartbeat_interval_ms"), "transport.heartbeat_interval_ms", 100, 10000)
    require_int_range(transport.get("communication_timeout_ms"), "transport.communication_timeout_ms", 250, 60000)


def validate_signal_heads(intersection: dict, prefix: str) -> None:
    signal_heads = intersection.get("signal_heads", [])
    if signal_heads is None:
        return
    if not isinstance(signal_heads, list):
        fail(f"{prefix}.signal_heads must be an array")
    for index, head in enumerate(signal_heads):
        if not isinstance(head, dict):
            fail(f"{prefix}.signal_heads[{index}] must be an object")
        require_string(head.get("id"), f"{prefix}.signal_heads[{index}].id")
        group = head.get("group")
        if group not in VALID_GROUPS:
            fail(f"{prefix}.signal_heads[{index}].group must be one of {sorted(VALID_GROUPS)}")


def validate_gpio(intersection: dict, prefix: str) -> None:
    pins = intersection.get("pins", [])
    if not isinstance(pins, list) or not pins:
        fail(f"{prefix}.pins must be a non-empty array")
    for index, pin in enumerate(pins):
        if not isinstance(pin, dict):
            fail(f"{prefix}.pins[{index}] must be an object")
        require_string(pin.get("signal_id"), f"{prefix}.pins[{index}].signal_id")
        if pin.get("color") not in VALID_COLORS:
            fail(f"{prefix}.pins[{index}].color must be one of {sorted(VALID_COLORS)}")
        require_int_range(pin.get("pin"), f"{prefix}.pins[{index}].pin", 0, 10000)
        if not isinstance(pin.get("active_high"), bool):
            fail(f"{prefix}.pins[{index}].active_high must be a boolean")


def validate_plc(intersection: dict, prefix: str) -> None:
    require_string(intersection.get("endpoint"), f"{prefix}.endpoint")
    registers = intersection.get("registers", [])
    if not isinstance(registers, list) or not registers:
        fail(f"{prefix}.registers must be a non-empty array")
    for index, register in enumerate(registers):
        if not isinstance(register, dict):
            fail(f"{prefix}.registers[{index}] must be an object")
        require_string(register.get("signal_id"), f"{prefix}.registers[{index}].signal_id")
        for key in ("address", "red_value", "amber_value", "green_value", "off_value"):
            require_int_range(register.get(key), f"{prefix}.registers[{index}].{key}", 0, 65535)


def validate_intersections(config: dict) -> None:
    intersections = config.get("intersections")
    if not isinstance(intersections, list) or not intersections:
        fail("intersections must be a non-empty array")

    ids = set()
    for index, intersection in enumerate(intersections):
        prefix = f"intersections[{index}]"
        if not isinstance(intersection, dict):
            fail(f"{prefix} must be an object")
        require_string(intersection.get("id"), f"{prefix}.id")
        if intersection["id"] in ids:
            fail(f"{prefix}.id duplicates another intersection id")
        ids.add(intersection["id"])

        adapter = intersection.get("adapter")
        if adapter not in VALID_ADAPTERS:
            fail(f"{prefix}.adapter must be one of {sorted(VALID_ADAPTERS)}")

        if "all_red_duration_ms" in intersection:
            require_int_range(intersection["all_red_duration_ms"], f"{prefix}.all_red_duration_ms", 500, 30000)
        if "fixed_phase_duration_ms" in intersection:
            require_int_range(intersection["fixed_phase_duration_ms"], f"{prefix}.fixed_phase_duration_ms", 3000, 120000)

        validate_signal_heads(intersection, prefix)
        if adapter == "gpio":
            validate_gpio(intersection, prefix)
        if adapter == "plc":
            validate_plc(intersection, prefix)


def validate(path: Path) -> None:
    with path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)
    if not isinstance(config, dict):
        fail("root config must be an object")
    validate_transport(config)
    validate_intersections(config)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_config.py <intersections.json>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    try:
        validate(path)
    except Exception as exc:
        print(f"Invalid real-light config {path}: {exc}", file=sys.stderr)
        return 1

    print(f"Config OK: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
