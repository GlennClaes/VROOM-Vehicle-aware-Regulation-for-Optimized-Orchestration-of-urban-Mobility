#!/bin/bash
# System Log Inspector
echo "📜 Fetching latest logs from Docker services..."

echo -e "\n--- BACKEND LOGS (last 20 lines) ---"
docker compose logs backend --tail 20

echo -e "\n--- SUMO-WEB3D LOGS (last 20 lines) ---"
docker compose logs sumo-web3d --tail 20

echo -e "\n--- FRONTEND LOGS (last 20 lines) ---"
docker compose logs frontend --tail 20

echo -e "\n💡 Use 'docker compose logs -f' to follow logs in real-time."
