#!/usr/bin/env python3
"""Validate Dockerfile and Compose naming conventions for VROOM."""

from __future__ import annotations

import re
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
ALLOWED_DOCKERFILE_NAMES = {"Dockerfile.dev", "Dockerfile.prod", "Dockerfile.train", "Dockerfile.base", "Dockerfile.test"}
ALLOWED_ROOT_COMPOSE_NAMES = {
    "docker-compose.yml",
    "docker-compose.dev.yml",
    "docker-compose.prod.yml",
    "docker-compose.production-real.yml",
}
ALLOWED_REAL_LIGHT_COMPOSE_NAMES = {"docker-compose.dev.yml", "docker-compose.prod.yml"}


def rel(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(REPO).as_posix()
    except ValueError:
        return str(resolved)


def error(errors: list[str], message: str) -> None:
    errors.append(message)


def iter_project_files(pattern: str) -> list[Path]:
    ignored_parts = {"node_modules", "dist", "build", ".git", "__pycache__"}
    return [
        path
        for path in REPO.rglob(pattern)
        if not any(part in ignored_parts for part in path.relative_to(REPO).parts)
    ]


def validate_dockerfiles(errors: list[str]) -> None:
    for path in iter_project_files("Dockerfile*"):
        if path.name not in ALLOWED_DOCKERFILE_NAMES:
            error(
                errors,
                f"{rel(path)} must be named one of {sorted(ALLOWED_DOCKERFILE_NAMES)}",
            )


def compose_kind(path: Path) -> str:
    name = path.name
    if name == "docker-compose.yml" or name == "docker-compose.dev.yml":
        return "dev"
    if name == "docker-compose.prod.yml" or name == "docker-compose.production-real.yml":
        return "prod"
    return "unknown"


def validate_compose_name(path: Path, errors: list[str]) -> None:
    relative = path.relative_to(REPO)
    if path.parent == REPO and path.name not in ALLOWED_ROOT_COMPOSE_NAMES:
        error(errors, f"{rel(path)} is not an allowed root compose filename")
    if relative.parts[:1] == ("production-real-traffic-lights",):
        if path.parent == REPO / "production-real-traffic-lights" and path.name not in ALLOWED_REAL_LIGHT_COMPOSE_NAMES:
            error(errors, f"{rel(path)} must be docker-compose.dev.yml or docker-compose.prod.yml")


def validate_compose_references(path: Path, errors: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    kind = compose_kind(path)
    current_context = Path(".")

    for line in text.splitlines():
        context_match = re.match(r"^\s*context:\s*[\"']?([^\"'\s]+)", line)
        if context_match:
            current_context = Path(context_match.group(1))
            continue

        dockerfile_match = re.match(r"^\s*dockerfile:\s*[\"']?([^\"'\s]+)", line)
        if not dockerfile_match:
            continue

        dockerfile = dockerfile_match.group(1)
        target = (path.parent / current_context / dockerfile).resolve()
        if not target.exists():
            error(errors, f"{rel(path)} references missing Dockerfile {dockerfile}")
            continue
        if kind == "dev" and target.name.endswith(".prod"):
            error(errors, f"{rel(path)} is a dev compose file but references {rel(target)}")
        if kind == "prod" and target.name.endswith(".dev"):
            error(errors, f"{rel(path)} is a prod compose file but references {rel(target)}")


def validate_compose_files(errors: list[str]) -> None:
    for pattern in ("docker-compose*.yml", "docker-compose*.yaml"):
        for path in iter_project_files(pattern):
            validate_compose_name(path, errors)
            validate_compose_references(path, errors)


def validate_root_dev_compose_alias(errors: list[str]) -> None:
    explicit_dev = REPO / "docker-compose.dev.yml"
    default_dev = REPO / "docker-compose.yml"

    if not explicit_dev.exists():
        error(errors, "root docker-compose.dev.yml is required for explicit dev/prod naming")
        return

    if default_dev.exists() and default_dev.read_text(encoding="utf-8") != explicit_dev.read_text(encoding="utf-8"):
        error(
            errors,
            "root docker-compose.yml must mirror docker-compose.dev.yml or be removed",
        )


def main() -> int:
    errors: list[str] = []
    validate_dockerfiles(errors)
    validate_compose_files(errors)
    validate_root_dev_compose_alias(errors)

    if errors:
        print("Docker layout validation failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("Docker layout OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
