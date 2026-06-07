#!/bin/bash
# Evaluate the best trained model

EPISODES=${1:-5}

echo "📊 Evaluating the best RL model (dqn_universal_best.pt) over $EPISODES episodes..."
python backend/rl/evaluate.py --model backend/rl/models/dqn_universal_best.pt --episodes $EPISODES --compare
