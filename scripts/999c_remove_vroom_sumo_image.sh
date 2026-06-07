#!/bin/bash
echo "🗑️ Removing SUMO-Web3D Docker Images..."
docker rmi vroom-sumo-web3d:dev vroom-sumo-web3d:prod vroom-sumo-base:latest --force
