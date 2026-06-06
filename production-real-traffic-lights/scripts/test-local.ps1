param(
    [switch]$SkipDocker,
    [switch]$DockerOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $root

Write-Host "== VROOM real traffic-light local test =="
Write-Host "Module: $root"

if (-not $DockerOnly) {
    Write-Host "`n[1/4] Validate example config"
    python "$root\tests\validate_config.py" "$root\config\intersections.example.json"

    Write-Host "`n[2/4] Configure and build C++ controller"
    cmake -S "$root" -B "$root\build" -DCMAKE_BUILD_TYPE=Release
    cmake --build "$root\build"

    Write-Host "`n[3/4] Run C++ tests"
    ctest --test-dir "$root\build" --output-on-failure

    Write-Host "`n[4/4] Run binary smoke test"
    $binaryCandidates = @(
        "$root\build\vroom-real-controller.exe",
        "$root\build\Release\vroom-real-controller.exe",
        "$root\build\Debug\vroom-real-controller.exe",
        "$root\build\vroom-real-controller"
    )
    $binary = $binaryCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $binary) {
        throw "Could not find vroom-real-controller binary in build output."
    }
    & $binary --once
}

if (-not $SkipDocker) {
    Write-Host "`n[Docker] Build production controller image"
    docker build `
        -f "$root\docker\Dockerfile.prod" `
        -t vroom-real-traffic-controller:local-check `
        "$root"

    Write-Host "`n[Docker] Run image smoke test"
    docker run --rm vroom-real-traffic-controller:local-check --once

    Write-Host "`n[Docker] Validate compose files"
    docker compose -f "$root\docker-compose.dev.yml" config --quiet
    docker compose -f "$root\docker-compose.prod.yml" config --quiet
    docker compose -f "$repo\docker-compose.production-real.yml" config --quiet
}

Write-Host "`nAll requested real-light checks completed."
