#!/bin/bash
echo "🏗️ Building Backend Docker Images..."
docker build -t vroom-backend-base:latest -f backend/Dockerfile.base backend
docker build -t vroom-backend:dev -f backend/Dockerfile.dev backend
docker build -t vroom-backend:test -f backend/Dockerfile.test backend
docker build -t vroom-backend:prod -f backend/Dockerfile.prod backend
echo "✅ Backend images build complete."
