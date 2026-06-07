#!/bin/bash
# Developer Environment Setup via Docker
echo "🛠️  Setting up Traffic AI Development Environment (Docker-based)..."

# 1. Verify Docker
echo -e "\n[1/3] Verifying Docker Installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed! Please install Docker Desktop first."
    exit 1
fi
docker --version
docker compose version

# 2. Build All Services
echo -e "\n[2/3] Building Docker Images (this might take a few minutes)..."
docker compose build --parallel
if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

# 3. Verify Scenario Integrity
echo -e "\n[3/3] Verifying SUMO Scenarios..."
if [ -f "backend/scenarios/hasselt_xl/normal.sumocfg" ]; then
    echo "✅ Scenarios found."
else
    echo "❌ Scenarios missing! Check backend/scenarios/"
    exit 1
fi

echo -e "\n🎉 Environment is ready!"
echo "-------------------------------------------------------"
echo "🚀 Start app:      ./scripts/006_run-app.sh"
echo "🧪 Run tests:      ./scripts/004_check-ci.sh"
echo "🤖 Start training: ./scripts/009_run-training.sh"
echo "📜 View logs:      ./scripts/008_inspect-logs.sh"
echo "-------------------------------------------------------"
