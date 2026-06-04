#!/bin/bash
# Start D3QN RL Training LOKAAL (niet in Docker)

export PYTHONPATH="$(pwd)/backend"
MODELS_DIR="backend/rl/models"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     🧠 VROOM D3QN Training Manager                  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check bestaande modellen
LATEST_MODEL=$(ls -t "$MODELS_DIR"/dqn_universal_*_final.pt 2>/dev/null | head -1)
BEST_MODEL="$MODELS_DIR/dqn_universal_best.pt"

if [ -n "$LATEST_MODEL" ]; then
    echo "📦 Laatste model: $(basename $LATEST_MODEL)"
fi
if [ -f "$BEST_MODEL" ]; then
    echo "🏆 Beste model:   $(basename $BEST_MODEL)"
fi
echo ""

echo "Kies een trainingsmodus:"
echo "─────────────────────────────────────────"
echo "  1) 🆕 Fresh training    (helemaal opnieuw, 500 episodes)"
echo "  2) ▶️  Verder trainen    (hervat laatste model, 500 episodes)"
echo "  3) 🏆 Verder op best    (hervat beste model, 500 episodes)"
echo "  4) ⚙️  Custom           (zelf episodes + model kiezen)"
echo "  q) Terug"
echo "─────────────────────────────────────────"
read -p "Keuze [1-4, q]: " choice

case $choice in
    1)
        echo ""
        echo "🆕 Starting FRESH training (500 episodes)..."
        python backend/rl/train_local.py --episodes 500 --fresh
        ;;
    2)
        if [ -n "$LATEST_MODEL" ]; then
            echo ""
            echo "▶️  Hervat training vanaf: $(basename $LATEST_MODEL)"
            python backend/rl/train_local.py --episodes 500
        else
            echo "❌ Geen bestaand model gevonden. Start fresh..."
            python backend/rl/train_local.py --episodes 500 --fresh
        fi
        ;;
    3)
        if [ -f "$BEST_MODEL" ]; then
            echo ""
            echo "🏆 Hervat training vanaf beste model..."
            python backend/rl/train_local.py --episodes 500 --load "$BEST_MODEL"
        else
            echo "❌ Geen best model gevonden. Start fresh..."
            python backend/rl/train_local.py --episodes 500 --fresh
        fi
        ;;
    4)
        read -p "Aantal episodes [500]: " episodes
        episodes=${episodes:-500}

        echo ""
        echo "Beschikbare modellen:"
        ls -1t "$MODELS_DIR"/*.pt 2>/dev/null | head -10 | while read f; do
            echo "  - $(basename $f)"
        done
        echo "  - (leeg = fresh)"
        echo ""

        read -p "Model bestandsnaam (of leeg voor fresh): " model_name

        if [ -z "$model_name" ]; then
            echo ""
            echo "🆕 Starting fresh training ($episodes episodes)..."
            python backend/rl/train_local.py --episodes "$episodes" --fresh
        else
            MODEL_PATH="$MODELS_DIR/$model_name"
            if [ -f "$MODEL_PATH" ]; then
                read -p "Epsilon override (leeg = automatisch): " eps
                EPS_FLAG=""
                if [ -n "$eps" ]; then
                    EPS_FLAG="--epsilon $eps"
                fi
                echo ""
                echo "▶️  Hervat training vanaf: $model_name ($episodes episodes)"
                python backend/rl/train_local.py --episodes "$episodes" --load "$MODEL_PATH" $EPS_FLAG
            else
                echo "❌ Model niet gevonden: $MODEL_PATH"
                exit 1
            fi
        fi
        ;;
    q|Q)
        echo "Tot ziens!"
        exit 0
        ;;
    *)
        echo "❌ Ongeldige keuze"
        exit 1
        ;;
esac
