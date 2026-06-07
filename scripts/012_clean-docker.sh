#!/bin/bash
echo "🧹 Cleaning up Docker environment..."
docker compose down --rmi all --volumes --remove-orphans
echo "✨ Docker cleanup finished."
