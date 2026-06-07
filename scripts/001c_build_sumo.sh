#!/bin/bash
echo "🏗️ Building SUMO-Web3D Docker Images..."
docker build -t vroom-sumo-base:latest -f sumo-web3d/Dockerfile.base sumo-web3d
docker build -t vroom-sumo-web3d:dev -f sumo-web3d/Dockerfile.dev sumo-web3d
docker build -t vroom-sumo-web3d:prod -f sumo-web3d/Dockerfile.prod sumo-web3d
echo "✅ SUMO-Web3D images build complete."
