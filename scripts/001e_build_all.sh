#!/bin/bash
echo "🚀 Building ALL VROOM Docker Images..."
chmod +x scripts/001_build_vroom_backend_image.sh scripts/001b_build_vroom_frontend_image.sh scripts/001c_build_vroom_sumo_image.sh scripts/001d_build_vroom_real_controller_image.sh
./scripts/001_build_vroom_backend_image.sh
./scripts/001b_build_vroom_frontend_image.sh
./scripts/001c_build_vroom_sumo_image.sh
./scripts/001d_build_vroom_real_controller_image.sh
echo "🎉 All Docker images have been built!"
