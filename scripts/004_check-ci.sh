#!/bin/bash
# Local CI Pipeline Simulation using Docker (No local installs needed)
echo "🏗️ Simulating Continuous Integration Pipeline via Docker..."

START_TIME=$SECONDS

# 1. Build a temporary 'ci-container' that has everything installed
echo -e "\n[1/4] Preparing CI environment..."
docker build -t traffic-ai-ci-check ./backend

# 2. Quality & Security (Inside Docker)
echo -e "\n[2/4] STEP: Quality & Security (Ruff & Bandit)"
docker run --rm traffic-ai-ci-check bash -c "pip install ruff bandit && ruff check . && bandit -r . -ll -ii"
if [ $? -ne 0 ]; then echo "❌ Quality checks failed!"; exit 1; fi

# 3. Backend Tests (Inside Docker)
echo -e "\n[3/4] STEP: Backend Testing"
docker run --rm -e PYTHONPATH=. -e DATABASE_URL=sqlite:///./test.db -e LOG_PATH=/tmp/test.log traffic-ai-ci-check pytest
if [ $? -ne 0 ]; then echo "❌ Backend tests failed!"; exit 1; fi

# 4. Frontend Tests (Inside Docker)
echo -e "\n[4/4] STEP: Frontend Quality & Testing"
docker build -t traffic-ai-frontend-check ./frontend
docker run --rm traffic-ai-frontend-check npm run test:unit
if [ $? -ne 0 ]; then echo "❌ Frontend tests failed!"; exit 1; fi

DURATION=$(( SECONDS - START_TIME ))
echo -e "\n✅ Docker-based CI Pipeline PASSED in $DURATION seconds!"
