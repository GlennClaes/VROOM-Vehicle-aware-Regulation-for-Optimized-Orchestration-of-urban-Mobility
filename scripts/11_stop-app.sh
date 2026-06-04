#!/bin/bash
# 11_stop-app.sh: Stop all services and cleanup
echo "🛑 Stopping Traffic AI Application..."

# Use --remove-orphans to ensure no rogue containers stay behind
docker compose down --remove-orphans

# Also check for any common lingering ports just in case
# (Port 8000, 5000, 5173, 8813)
echo "✨ Cleanup complete. Services are stopped."
