#!/bin/bash
echo "🗑️ Removing Frontend Docker Images..."
docker rmi vroom-frontend:dev vroom-frontend:prod vroom-frontend:test vroom-frontend-base:latest --force
