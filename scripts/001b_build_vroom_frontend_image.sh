#!/bin/bash
echo "🏗️ Building Frontend Docker Images..."
docker build -t vroom-frontend-base:latest -f frontend/Dockerfile.base frontend
docker build -t vroom-frontend:dev -f frontend/Dockerfile.dev frontend
docker build -t vroom-frontend:test -f frontend/Dockerfile.test frontend
docker build -t vroom-frontend:prod -f frontend/Dockerfile.prod frontend
echo "✅ Frontend images build complete."
