#!/bin/bash
echo "🧹 Cleaning up VROOM Docker System..."
chmod +x scripts/997d_stop_all.sh scripts/998a_remove_backend_container.sh scripts/998b_remove_frontend_container.sh scripts/998c_remove_sumo_container.sh
./scripts/997d_stop_all.sh
./scripts/998a_remove_backend_container.sh
./scripts/998b_remove_frontend_container.sh
./scripts/998c_remove_sumo_container.sh
echo "🗑️ Pruning unused Docker networks and volumes..."
docker network prune -f
docker volume prune -f
echo "✨ Cleanup finished!"
