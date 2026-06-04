# Backend: FastAPI, Database and Reinforcement Learning

The backend contains the HTTP API, authentication, persistence layer and reinforcement-learning code for VROOM. It is a FastAPI application with SQLModel/SQLAlchemy models, MySQL support in Docker, SQLite for CI tests, and a PyTorch DQN-based training pipeline for the Hasselt XL SUMO scenario.

## What Runs Here

| Part | Files | Purpose |
| --- | --- | --- |
| FastAPI app | `app/main.py` | Creates the API, registers routes, initializes database tables and preloads the RL model in the background. |
| API routes | `app/api/routes/` | Auth, users, presets, simulation results and RL endpoints. |
| Database layer | `app/db/` | Session setup and SQLModel models. |
| Schemas | `app/schemas/` | Pydantic request/response models. |
| RL environment | `rl/sumo_env.py` | SUMO/Gymnasium environment with a 48-dimensional observation space. |
| DQN agent | `rl/dqn_agent.py` | PyTorch Dueling DQN style agent used by training and inference. |
| Training runner | `rl/train_local.py` | Main local training script. |
| Evaluation | `rl/evaluate.py` | Evaluates trained checkpoints. |
| Scenarios | `scenarios/hasselt_xl/` | SUMO configs, routes, generated trip files and output data. |
| Models | `rl/models/` | Saved `.pt` checkpoints. |

## API

Run the backend through Docker Compose and open `http://localhost:8000/docs` for the live OpenAPI page.

Main routes:

| Group | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /register`, `POST /login`, `POST /logout`, `GET /me` |
| Users | `GET /users/me`, `PUT /users/update` |
| Presets | `POST /presets`, `GET /presets`, `PUT /presets/{preset_id}`, `DELETE /presets/{preset_id}` |
| Simulations | `POST /simulations/`, `GET /simulations/`, `DELETE /simulations/{result_id}` |
| RL training | `POST /rl/training/start`, `GET /rl/training/status`, `POST /rl/training/stop`, `GET /rl/training/log`, `GET /rl/training/stream` |
| RL inference | `POST /rl/inference/start`, `POST /rl/inference/predict`, `POST /rl/inference/predict_batch`, `GET /rl/inference/status`, `POST /rl/inference/stop` |
| RL models | `GET /rl/models`, `DELETE /rl/models/{model_name}` |
| Simulator status | `GET /rl/simulation/status` |

The app adds basic security headers and CORS through `app/core/cors.py`.

## Local Development

The normal development path is the VROOM menu from the repository root:

```bash
./vroom.sh
```

Choose option `2` for the development stack. That runs `make dev`. If Dockerfiles or dependencies changed, use `make dev-build` directly.

```bash
make dev
```

Backend details in the development stack:

| Setting | Value |
| --- | --- |
| Container | `backend` |
| Dockerfile | `backend/Dockerfile.dev` |
| Command | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app` |
| API port | `8000` |
| Database URL | `mysql+pymysql://myuser:mypassword@mysql:3306/vroomdb` |
| Redis | `redis:6379` |
| Source mount | `./backend:/app` |

For quick backend-only checks inside the running container:

```bash
docker compose exec backend pytest
docker compose exec backend pytest --cov=app --cov=rl --cov-report=term-missing
docker compose exec backend python -m rl.evaluate --episodes 5
```

## Training

The easiest path is the VROOM menu:

```bash
./vroom.sh
```

Choose option `7` (`Start AI Training`). That calls the same target as:

```bash
make train
```

That starts `scripts/09_run-training.sh` from the repository root. The script sets `PYTHONPATH` to `backend`, lists the latest/best checkpoints from `backend/rl/models`, and asks whether you want fresh training, continued training or a custom run.

Direct commands:

```bash
# PowerShell, from repository root
$env:PYTHONPATH = "$PWD/backend"
python backend/rl/train_local.py --episodes 500 --fresh
python backend/rl/train_local.py --episodes 500 --load backend/rl/models/dqn_universal_best.pt
python backend/rl/train_local.py --episodes 500 --load backend/rl/models/dqn_universal_best.pt --epsilon 0.05
```

```bash
# Linux/macOS/Git Bash, from repository root
export PYTHONPATH="$(pwd)/backend"
python backend/rl/train_local.py --episodes 500 --fresh
```

Important training files:

| File | Role |
| --- | --- |
| `rl/train_local.py` | Main runner for Hasselt XL training. |
| `rl/sumo_env.py` | SUMO environment and reward/state logic. |
| `rl/dqn_agent.py` | Neural network, replay memory and action selection. |
| `rl/models/` | Output checkpoints such as `dqn_universal_best.pt`. |
| `rl/training/*.json` | Training and evaluation logs/results. |

## Evaluation

Use the VROOM menu and choose option `8` (`Evalueer AI Model`), or run the Makefile target directly:

```bash
make eval
```

Or run the evaluator directly:

```bash
$env:PYTHONPATH = "$PWD/backend"
python backend/rl/evaluate.py --model backend/rl/models/dqn_universal_best.pt --episodes 5 --compare
```

Useful flags:

| Flag | Meaning |
| --- | --- |
| `--model` | Path to a `.pt` checkpoint. If omitted, the script chooses a default where possible. |
| `--episodes` | Number of evaluation episodes. Default is 5. |
| `--compare` | Include comparison logic/results where available. |

## Docker Images

| Dockerfile | Used by | Notes |
| --- | --- | --- |
| `Dockerfile.dev` | `docker-compose.yml` | FastAPI development image with reload. |
| `Dockerfile.prod` | `docker-compose.prod.yml` and CD | Production backend image with healthcheck support. |
| `Dockerfile.train` | `make build-train` and CD | Dedicated image for training dependencies, including CPU PyTorch. |

The active `make train` path uses the local script, not the training container. The training Dockerfile is still built in CD and can be used as a reproducible base for training jobs.

## Tests and CI

Backend tests live under `app/tests/`. CI installs `backend/requirements.txt`, sets `DATABASE_URL=sqlite:///./test.db`, and runs:

```bash
PYTHONPATH=. pytest --cov=app --cov=baseline --cov-fail-under=80 --maxfail=1 --disable-warnings --cov-report=term-missing --cov-report=json:coverage.json
```

Local commands:

```bash
make test-backend
docker compose exec backend pytest --cov=app --cov=rl --cov-report=term-missing
```

## Configuration Notes

Default settings are in `app/core/config.py`. In Docker, the compose files override the important values:

| Variable | Development | Production |
| --- | --- | --- |
| `DATABASE_URL` | `mysql+pymysql://myuser:mypassword@mysql:3306/vroomdb` | `mysql+pymysql://myuser:mypassword@mysql-prod:3306/mydatabase` |
| `REDIS_HOST` | `redis` | `redis-prod` |
| `REDIS_PORT` | `6379` | `6379` |
| `TZ` | `Europe/Brussels` | `Europe/Brussels` |

Do not commit real secrets. The current development values are project defaults for local containers.
