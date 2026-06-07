#!/bin/bash
# 07_verify-api.sh: Verify API Endpoints
echo "📡 Verifying API Endpoints..."

# Function to check health
check_health() {
    curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs | grep -q "200"
}

# Auto-start check
if ! check_health; then
    echo -e "🚀 Services are not running or still booting! Attempting background start..."
    bash "$(dirname "$0")/006_run-app.sh" -d
    
    echo "⏳ Waiting for backend to become healthy (max 30s)..."
    MAX_RETRIES=30
    COUNT=0
    while ! check_health && [ $COUNT -lt $MAX_RETRIES ]; do
        sleep 1
        COUNT=$((COUNT+1))
        echo -n "."
    done
    echo -e "\n"
fi

# 1. Backend Health
echo -n "Backend API Health: "
if check_health; then echo "✅ OK"; else echo "❌ FAIL"; fi

# 2. RL Routes
echo -n "RL Model Routes:   "
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/rl/models | grep -q "200" && echo "✅ OK" || echo "❌ FAIL"

# 3. Sumo-Web3D (TraCI Port)
echo -n "Sumo-Web3D Port:   "
# Use /dev/tcp for a quick port check without requiring nc
(echo > /dev/tcp/localhost/8813) 2>/dev/null && echo "✅ OK" || echo "❌ FAIL (Service not listening)"

# 4. Frontend
echo -n "Frontend Dashboard: "
MAX_RETRIES=15
COUNT=0
FRONTEND_OK=false
while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200"; then
        FRONTEND_OK=true
        break
    fi
    sleep 1
    COUNT=$((COUNT+1))
done

if [ "$FRONTEND_OK" = true ]; then echo "✅ OK"; else echo "❌ FAIL"; fi

echo -e "\n✨ System verification complete."
