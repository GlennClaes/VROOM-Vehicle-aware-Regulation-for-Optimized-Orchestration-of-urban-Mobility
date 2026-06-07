#!/bin/bash
echo "🚀 Building ALL VROOM Docker Images..."
chmod +x scripts/001a_build_backend.sh scripts/001b_build_frontend.sh scripts/001c_build_sumo.sh scripts/001d_build_real_controller.sh
./scripts/001a_build_backend.sh
./scripts/001b_build_frontend.sh
./scripts/001c_build_sumo.sh
./scripts/001d_build_real_controller.sh
echo "🎉 All Docker images have been built!"
