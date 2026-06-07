#!/bin/bash
# Unified Testing Script via Docker
echo "🧪 Running All Tests inside Docker..."

# Backend
echo -e "\n[1/2] Running Backend Tests..."
docker run --rm -e PYTHONPATH=. traffic-ai-ci-check pytest

# Frontend
echo -e "\n[2/2] Running Frontend Tests..."
docker build -t traffic-ai-frontend-check ./frontend
docker run --rm traffic-ai-frontend-check npm run test:unit

echo -e "\n✅ All tests passed successfully!"
