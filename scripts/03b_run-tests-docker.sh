#!/bin/bash
# Run tests inside Docker containers
echo "🧪 Running tests inside Docker (No local installs needed)..."

# Backend
echo -e "\n[1/2] Running Backend Tests in Docker..."
docker compose run --rm backend pytest

# Frontend
echo -e "\n[2/2] Running Frontend Tests in Docker..."
docker compose run --rm frontend npm run test:unit
