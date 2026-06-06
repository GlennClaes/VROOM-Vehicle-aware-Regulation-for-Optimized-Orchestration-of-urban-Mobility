#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_DIR=$(CDPATH= cd -- "$ROOT_DIR/.." && pwd)

SKIP_DOCKER=0
DOCKER_ONLY=0

for arg in "$@"; do
    case "$arg" in
        --skip-docker) SKIP_DOCKER=1 ;;
        --docker-only) DOCKER_ONLY=1 ;;
        *)
            echo "Unknown argument: $arg" >&2
            exit 2
            ;;
    esac
done

echo "== VROOM real traffic-light local test =="
echo "Module: $ROOT_DIR"

if [ "$DOCKER_ONLY" -eq 0 ]; then
    echo
    echo "[1/4] Validate example config"
    python3 "$ROOT_DIR/tests/validate_config.py" "$ROOT_DIR/config/intersections.example.json"

    echo
    echo "[2/4] Configure and build C++ controller"
    cmake -S "$ROOT_DIR" -B "$ROOT_DIR/build" -DCMAKE_BUILD_TYPE=Release
    cmake --build "$ROOT_DIR/build"

    echo
    echo "[3/4] Run C++ tests"
    ctest --test-dir "$ROOT_DIR/build" --output-on-failure

    echo
    echo "[4/4] Run binary smoke test"
    "$ROOT_DIR/build/vroom-real-controller" --once
fi

if [ "$SKIP_DOCKER" -eq 0 ]; then
    echo
    echo "[Docker] Build production controller image"
    docker build \
        -f "$ROOT_DIR/docker/Dockerfile.prod" \
        -t vroom-real-traffic-controller:local-check \
        "$ROOT_DIR"

    echo
    echo "[Docker] Run image smoke test"
    docker run --rm vroom-real-traffic-controller:local-check --once

    echo
    echo "[Docker] Validate compose files"
    docker compose -f "$ROOT_DIR/docker-compose.dev.yml" config --quiet
    docker compose -f "$ROOT_DIR/docker-compose.prod.yml" config --quiet
    docker compose -f "$REPO_DIR/docker-compose.production-real.yml" config --quiet
fi

echo
echo "All requested real-light checks completed."
