# 🏠 Local Training & Development (Non-Docker)

While we recommend using `./vroom.sh train` (Docker), you can also run the AI directly on your machine for maximum performance.

## 🛠️ Setup
1. Install SUMO (Eclipse SUMO).
2. Install Python dependencies:
   ```bash
   pip install gymnasium torch numpy traci
   ```

## 🤖 Running Training
The `train_local.py` script is optimized for local runs:

```bash
# Start 48-dim training (Hasselt XL)
python backend/rl/train_local.py --episodes 200

# With SUMO GUI (to visualize)
python backend/rl/train_local.py --gui
```

## 📊 Models & Evaluation
- Models are saved in `backend/rl/models/`.
- The system automatically saves `dqn_universal_best.pt`.
- Use the CLI for evaluation:
  ```bash
  ./vroom.sh eval
  ```

## 🔍 Good to know
- The script automatically detects `SUMO_HOME` on Windows (`C:\Program Files (x86)\Eclipse\Sumo`).
- The state-space is now **48 features** (density, pressure, waiting time, neighbors).
- The AI controls **28 intersections** simultaneously via a multi-agent wrapper.
