#!/bin/bash
echo "🗑️ Removing Backend Docker Images..."
docker rmi vroom-backend:dev vroom-backend:prod vroom-backend:test vroom-backend-base:latest --force
