#!/bin/bash
# Quality & Security Checks via Docker
echo "🔍 Running Quality & Security Checks inside Docker..."

# Use the CI check image we built
docker run --rm traffic-ai-ci-check bash -c "pip install ruff bandit && ruff check . && bandit -r . -ll -ii"

echo -e "\n✨ Quality checks finished."
