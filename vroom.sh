#!/bin/bash

# 🚦 VROOM TRAFFIC AI - ULTIMATE CONTROL CENTER 🚦
# De volledige interactieve CLI voor alle infrastructurele taken.

# Kleuren
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

show_logo() {
    clear
    echo -e "${CYAN}"
    echo "  __      __  _____    ____     ____    __  __ "
    echo "  \ \    / / |  __ \  / __ \   / __ \  |  \/  |"
    echo "   \ \  / /  | |__) | |  | |  | |  | | | \  / |"
    echo "    \ \/ /   |  _  /  |  | |  | |  | | | |\/| |"
    echo "     \  /    | | \ \  |  |__| | |__| | | |  | |"
    echo "      \/     |_|  \_\  \____/   \____/  |_|  |_|"
    echo -e "      ${YELLOW}TRAFFIC AI - FULL INFRASTRUCTURE CONTROL${NC}"
    echo ""
}

while true; do
    show_logo
    echo -e "${BOLD}Selecteer een actie:${NC}"
    echo "------------------------------------------------"
    echo -e "${BOLD}[BUILD & START]${NC}"
    echo -e " 1) ${CYAN}Build Setup${NC}         (make setup)      10) ${MAGENTA}Code Quality Check${NC} (make quality)"
    echo -e " 2) ${GREEN}Start Development${NC}   (make dev)        11) ${YELLOW}VROOM System Doctor${NC}(make doctor)"
    echo -e " 3) ${MAGENTA}Start Production${NC}    (make prod)"
    echo ""
    echo -e "${BOLD}[MONITORING & LOGS]${NC}"
    echo -e " 4) ${YELLOW}Live Health Dashboard${NC} (make dashboard) 12) ${CYAN}Backup DB & Models${NC} (make backup)"
    echo -e " 5) Bekijk Live Logs       (make logs)      13) ${CYAN}Restore Last Backup${NC} (make restore)"
    echo -e " 6) API Status Check       (make status)"
    echo ""
    echo -e "${BOLD}[AI & TRAINING]${NC}"
    echo -e " 7) ${GREEN}Start AI Training${NC}   (make train)"
    echo -e " 8) ${CYAN}Evalueer AI Model${NC}   (make eval)"
    echo ""
    echo -e "${BOLD}[TESTING & QUALITY]${NC}"
    echo -e " 9) ${BOLD}Volledige CI Test${NC}    (make test)       17) ${GREEN}Test Backend Only${NC}   (make test-backend)"
    echo -e "14) Docker System Prune    (make prune)      18) ${GREEN}Test Frontend Only${NC}  (make test-frontend)"
    echo -e "                                           19) ${YELLOW}Frontend Watch Mode${NC} (make test-frontend-watch)"
    echo -e "                                           20) ${MAGENTA}Frontend UI Mode${NC}    (make test-frontend-ui)"
    echo ""
    echo -e "${BOLD}[CI/CD & DEVOPS]${NC}"
    echo -e " 21) ${BLUE}Validate CI Config${NC}                    22) ${BLUE}Test PR Labeler${NC}"
    echo -e " 23) ${BLUE}Simulation Full CI${NC}                    24) ${BLUE}Build Training Image${NC}"
    echo ""
    echo -e "${BOLD}[CLEANUP]${NC}"
    echo -e " 15) ${RED}Stop alle services${NC}    (make stop)"
    echo -e " 16) ${RED}Hard Clean / Reset${NC}    (make clean)"
    echo ""
    echo -e " q) Sluiten"
    echo "------------------------------------------------"
    read -p "Keuze [1-24, q]: " choice

    case $choice in
        1) make setup ;;
        2) make dev ;;
        3) make prod ;;
        4) make dashboard ;;
        5) make logs ;;
        6) make status ;;
        7) make train ;;
        8) make eval ;;
        9) make test ;;
        10) make quality ;;
        11) make doctor ;;
        12) make backup ;;
        13) make restore ;;
        14) make prune ;;
        15) make stop ;;
        16) make clean ;;
        17) make test-backend ;;
        18) make test-frontend ;;
        19) make test-frontend-watch ;;
        20) make test-frontend-ui ;;
        21) 
            echo "🔍 Validating GitHub Actions Workflows..."
            ls .github/workflows/*.yml | xargs -n1 npx -y yaml-validator
            ;;
        22) 
            echo "🏷️ Testing Labeler Config..."
            cat .github/labeler.yml
            echo -e "\n${YELLOW}Tip: Use 'action-labeler-test' locally if installed.${NC}"
            ;;
        23) 
            echo "🚀 Simulating Full CI Pipeline Locally..."
            make ci
            ;;
        24)
            make build-train
            ;;
        q) echo "Tot ziens!"; exit 0 ;;
        *) echo -e "${RED}Ongeldige keuze.${NC}"; sleep 1 ;;
    esac

    echo ""
    read -p "Druk op [ENTER] om terug te gaan naar het menu..."
done
