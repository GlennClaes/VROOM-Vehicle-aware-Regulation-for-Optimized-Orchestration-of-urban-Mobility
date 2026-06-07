#!/bin/bash
# SUMO Environment Debugger (Docker-based)
echo "🚦 Debugging SUMO Environment & Networks (via Docker)..."

# 1. Check Network Files
echo -e "\nChecking Hasselt XL network files..."
# Look for any .net.xml or .net.xml.gz in the scenario dir
NET_FILE=$(ls backend/scenarios/hasselt_xl/*.net.xml* | head -n 1)
if [ -f "$NET_FILE" ]; then
    echo "✅ Network file found: $NET_FILE"
else
    echo "❌ Network file MISSING in backend/scenarios/hasselt_xl/"
    exit 1
fi

# 2. Headless Simulation Test IN DOCKER
echo -e "\nRunning 100-step headless simulation test inside Docker..."
# We use the sumo-web3d service from docker-compose, which has SUMO installed
docker compose run --rm sumo-web3d sumo -c /app/backend/scenarios/hasselt_xl/normal.sumocfg --end 100 --no-warnings --no-step-log

if [ $? -eq 0 ]; then
    echo "✅ Headless simulation test PASSED (inside Docker)."
else
    echo "❌ Headless simulation test FAILED."
    echo "💡 Hint: Ensure you ran ./setup-dev.sh to build the traffic-ai-ci-check image."
fi

echo -e "\n✨ SUMO Debugging finished."
