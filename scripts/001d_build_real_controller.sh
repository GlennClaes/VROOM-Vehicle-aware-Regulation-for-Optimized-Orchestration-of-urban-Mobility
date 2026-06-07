#!/bin/bash
echo "🏗️ Building C++ Real Traffic Controller Docker Images..."
docker build -t vroom-real-traffic-controller:dev -f production-real-traffic-lights/docker/Dockerfile.dev production-real-traffic-lights
docker build -t vroom-real-traffic-controller:prod -f production-real-traffic-lights/docker/Dockerfile.prod production-real-traffic-lights
echo "✅ C++ Real Traffic Controller images build complete."
