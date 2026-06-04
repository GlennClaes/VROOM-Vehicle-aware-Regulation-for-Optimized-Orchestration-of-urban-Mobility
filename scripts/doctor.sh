#!/bin/bash

# 🏥 VROOM SYSTEM DOCTOR
# Controleert of de infrastructuur en afhankelijkheden correct zijn ingesteld.

# Kleuren
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}🚦 VROOM System Checkup...${NC}"
echo "------------------------------------------------"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "[${GREEN}OK${NC}] $1 is geïnstalleerd. (${YELLOW}$( $1 --version | head -n 1 )${NC})"
    else
        echo -e "[${RED}FAIL${NC}] $1 is NIET gevonden! Installeer $1 om door te gaan."
        ERRORS=$((ERRORS+1))
    fi
}

ERRORS=0

# 1. Check tools
echo -e "${BOLD}1. Tools controleren:${NC}"
check_command "docker"
check_command "git"
check_command "curl"
check_command "make"

# 2. Check Docker Compose (kan 'docker compose' of 'docker-compose' zijn)
if docker compose version &> /dev/null; then
    echo -e "[${GREEN}OK${NC}] docker compose is beschikbaar."
else
    echo -e "[${RED}FAIL${NC}] docker compose plugin is NIET gevonden."
    ERRORS=$((ERRORS+1))
fi

# 3. Check .env bestand
echo -e "\n${BOLD}2. Configuratie controleren:${NC}"
if [ -f ".env" ]; then
    echo -e "[${GREEN}OK${NC}] .env bestand is aanwezig."
else
    echo -e "[${YELLOW}WARN${NC}] .env bestand ontbreekt! Maak er een aan op basis van .env.example."
    # We tellen dit niet als harde error, maar als waarschuwing
fi

# 4. Check poortbezetting
echo -e "\n${BOLD}3. Poorten controleren:${NC}"
for port in 8000 5173 5000 3306 8081; do
    if netstat -an | grep ":$port " &> /dev/null; then
        echo -e "[${RED}CONFLICT${NC}] Poort $port is al in gebruik! Dit kan Docker opstartfouten veroorzaken."
        ERRORS=$((ERRORS+1))
    else
        echo -e "[${GREEN}OK${NC}] Poort $port is vrij."
    fi
done

# 5. Check Disk Space
echo -e "\n${BOLD}4. Systeembronnen:${NC}"
FREE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo -e "[${GREEN}INFO${NC}] Beschikbare schijfruimte in huidige map: $FREE_SPACE"

echo "------------------------------------------------"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ Alles ziet er goed uit! Je bent klaar voor de start.${NC}"
else
    echo -e "${RED}${BOLD}❌ Er zijn $ERRORS probleem/problemen gevonden.${NC}"
    echo "Los deze op voordat je de stack opstart."
fi
