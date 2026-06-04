#!/bin/bash
set -e

export PYTHONUNBUFFERED=1

echo "======================================"
echo "  SUMO Web3D Container ($( [ "$ENV" == "production" ] && echo "PROD" || echo "DEV" ))"
echo "  SUMO version : $(sumo --version 2>&1 | head -1)"
echo "======================================"

cd /app

if [ "$ENV" == "production" ]; then
    echo "[SumoWeb3D] Production mode detected."
    # Bouw de frontend maar skip de type-check (vue-tsc) om crashes te voorkomen
    # Save all static 3D assets before build (vite build might still overwrite some)
    echo "[SumoWeb3D] Backing up static assets..."
    mkdir -p /tmp/static_backup
    cp -r /app/sumo_web3d/static/* /tmp/static_backup/ 2>/dev/null || true
    
    VITE_BASE_URL=/map/ npx vite build
    
    # Restore and merge static assets after build
    echo "[SumoWeb3D] Restoring static assets..."
    cp -rn /tmp/static_backup/* /app/sumo_web3d/static/ 2>/dev/null || true
    
    echo "[SumoWeb3D] Starting Python server..."
    python3 -m sumo_web3d.server.server
else
    echo "[SumoWeb3D] Development mode detected."
    echo "[SumoWeb3D] Starting frontend dev server..."
    npm run dev -- --host 0.0.0.0 --port 3000 &
    
    echo "[SumoWeb3D] Starting Python backend server..."
    python3 -m sumo_web3d.server.server
fi
