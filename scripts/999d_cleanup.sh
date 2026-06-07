#!/bin/bash
echo "🧹 Cleaning up VROOM Docker System..."
chmod +x scripts/997d_stop_vroom_all_containers.sh scripts/998_remove_vroom_backend_container.sh scripts/998b_remove_vroom_frontend_container.sh scripts/998c_remove_vroom_sumo_container.sh
./scripts/997d_stop_vroom_all_containers.sh
./scripts/998_remove_vroom_backend_container.sh
./scripts/998b_remove_vroom_frontend_container.sh
./scripts/998c_remove_vroom_sumo_container.sh
echo "🗑️ Pruning unused Docker networks and volumes..."
docker network prune -f
docker volume prune -f
echo "✨ Cleanup finished!"
