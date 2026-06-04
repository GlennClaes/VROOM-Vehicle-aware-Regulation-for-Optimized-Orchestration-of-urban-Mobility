#!/bin/bash

# 💾 VROOM BACKUP & RESTORE TOOL
# Maakt backups van de database en AI-modellen.

# Configuratie
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER="db"
RL_VOLUME="research-project-25-26-ain03_rl_data" # Aanpassen aan jouw projectnaam indien nodig

# Kleuren
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

mkdir -p $BACKUP_DIR

show_help() {
    echo "Gebruik: ./scripts/backup-data.sh [backup|restore]"
}

do_backup() {
    echo -e "${CYAN}Backup starten...${NC}"
    
    # 1. Database Dump
    echo -e "   - Database exporteren..."
    docker exec $DB_CONTAINER mysqldump -u myuser -pmypassword vroomdb > $BACKUP_DIR/vroomdb_$TIMESTAMP.sql
    
    # 2. RL Models Backup (Volume)
    echo -e "   - RL Modellen inpakken..."
    docker run --rm -v $RL_VOLUME:/volume -v $(pwd)/$BACKUP_DIR:/backup alpine \
        tar czf /backup/rl_models_$TIMESTAMP.tar.gz -C /volume .

    echo -e "${GREEN}${BOLD}✅ Backup succesvol opgeslagen in $BACKUP_DIR${NC}"
    ls -lh $BACKUP_DIR/*$TIMESTAMP*
}

do_restore() {
    echo -e "${YELLOW}Restore starten...${NC}"
    # Hier zouden we interactief kunnen vragen welk bestand, maar voor nu de laatste
    LATEST_SQL=$(ls -t $BACKUP_DIR/*.sql | head -1)
    LATEST_RL=$(ls -t $BACKUP_DIR/*.tar.gz | head -1)

    if [ -z "$LATEST_SQL" ]; then
        echo "Geen backup gevonden."
        exit 1
    fi

    echo -e "   - Database herstellen van $LATEST_SQL..."
    cat $LATEST_SQL | docker exec -i $DB_CONTAINER mysql -u myuser -pmypassword vroomdb

    echo -e "   - RL Modellen herstellen van $LATEST_RL..."
    docker run --rm -v $RL_VOLUME:/volume -v $(pwd)/$BACKUP_DIR:/backup alpine \
        sh -c "rm -rf /volume/* && tar xzf /backup/$(basename $LATEST_RL) -C /volume"

    echo -e "${GREEN}${BOLD}✅ Systeem succesvol hersteld naar laatste backup.${NC}"
}

case "$1" in
    backup) do_backup ;;
    restore) do_restore ;;
    *) show_help ;;
esac
