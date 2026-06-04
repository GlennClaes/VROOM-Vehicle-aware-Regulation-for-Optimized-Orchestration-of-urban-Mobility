#!/bin/bash

# VROOM Simulation Health Dashboard (Enhanced with Coverage)
# Dit script geeft een live overzicht van de systeemstatus en code kwaliteit

# Kleuren
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear

while true; do
    echo -e "${CYAN}${BOLD}================================================================${NC}"
    echo -e "${CYAN}${BOLD}🚦 VROOM TRAFFIC AI - SIMULATION HEALTH DASHBOARD 🚦${NC}"
    echo -e "${CYAN}${BOLD}================================================================${NC}"
    echo ""

    # 1. Docker Container Status
    echo -e "${BOLD}[1] Docker Containers Status:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""

    # 2. Service Health & Coverage
    echo -e "${BOLD}[2] Service Health & Quality:${NC}"
    
    # Backend check & coverage
    BE_COV="N/A"
    if [ -f "backend/coverage.json" ]; then
        BE_COV=$(python -c "import json; print(round(json.load(open('backend/coverage.json'))['totals']['percent_covered']))")%
    fi

    if curl -s --max-time 2 http://localhost:8000/docs > /dev/null; then
        echo -e "   Backend API:   ${GREEN}ONLINE${NC}  (Coverage: ${YELLOW}$BE_COV${NC})"
    else
        echo -e "   Backend API:   ${RED}OFFLINE${NC} (Coverage: ${YELLOW}$BE_COV${NC})"
    fi

    # Frontend check & coverage
    FE_COV="N/A"
    if [ -f "frontend/coverage/coverage-summary.json" ]; then
        FE_COV=$(node -e "const s=require('./frontend/coverage/coverage-summary.json'); console.log(Math.round(s.total.lines.pct));")%
    fi

    if curl -s --max-time 2 http://localhost:5173 > /dev/null; then
        echo -e "   Frontend App:  ${GREEN}ONLINE${NC}  (Coverage: ${YELLOW}$FE_COV${NC})"
    else
        echo -e "   Frontend App:  ${RED}OFFLINE${NC} (Coverage: ${YELLOW}$FE_COV${NC})"
    fi

    # Database check
    if docker exec db mysqladmin ping -h localhost -u myuser -pmypassword > /dev/null 2>&1; then
        echo -e "   Database:      ${GREEN}ONLINE${NC}"
    else
        echo -e "   Database:      ${RED}OFFLINE${NC}"
    fi

    echo ""
    # 3. AI Training Status
    echo -e "${BOLD}[3] AI Training Status:${NC}"
    TRAIN_STATUS=$(curl -s --max-time 2 http://localhost:8000/rl/training/status | grep -o '"active":[a-z]*' | cut -d':' -f2)
    if [ "$TRAIN_STATUS" == "true" ]; then
        echo -e "   Status:        ${GREEN}TRAINING ACTIEF 🧠${NC}"
    else
        echo -e "   Status:        IDLE"
    fi

    echo ""
    echo -e "${CYAN}Ververst elke 2 seconden. Druk op [CTRL+C] om te stoppen.${NC}"
    echo -e "${CYAN}Tip: Draai 'make test-backend' of 'make test-frontend' om coverage bij te werken.${NC}"
    
    sleep 2
    clear
done
