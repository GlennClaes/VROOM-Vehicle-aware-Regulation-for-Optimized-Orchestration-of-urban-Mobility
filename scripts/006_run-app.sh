#!/bin/bash
# 06_run-app.sh: Start all services
DETACHED=""
if [[ "$1" == "-d" ]]; then
    DETACHED="-d"
fi

echo "🚀 Starting Traffic AI Application..."

# Ensure we start fresh to avoid 'Address already in use' or 'Conflict' errors
docker compose down --remove-orphans 2>/dev/null

if [[ "$DETACHED" == "-d" ]]; then
    docker compose up --build -d
    echo "✨ Services started in the background."
    echo "💡 Use './vroom.sh logs' to see the output."
else
    docker compose up --build
fi
