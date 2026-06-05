# VROOM: AI Traffic Control for Hasselt XL

[![Continuous Integration](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/CI.yml/badge.svg)](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/CI.yml)
[![Continuous Deployment](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/CD.yml/badge.svg)](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/CD.yml)
[![Security Scan](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/security.yml/badge.svg)](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/security.yml)
[![Latest Version](https://img.shields.io/badge/version-v0.0.10-brightgreen)](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/releases)
[![Backend Coverage](https://img.shields.io/badge/Backend_Coverage-92%25-brightgreen)](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/CI.yml)
[![Frontend Coverage](https://img.shields.io/badge/Frontend_Coverage-92%25-brightgreen)](https://github.com/GlennClaes/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/actions/workflows/CI.yml)

VROOM is a research project for traffic-light control in the Hasselt XL SUMO network. The application combines a Vue dashboard, a FastAPI backend, a SUMO/Three.js 3D simulator and a PyTorch DQN-based reinforcement-learning pipeline. The goal is to compare fixed-time traffic control with learned control strategies and to make the simulation easy to run, inspect and evaluate.

The project is built around one shared scenario folder, `backend/scenarios/hasselt_xl`, and the trained model checkpoints in `backend/rl/models`. The frontend controls the simulation, the backend exposes API and RL endpoints, and `sumo-web3d` renders the live SUMO state in the browser.

## Quick Start

You need Docker Desktop with Docker Compose. For local training outside Docker you also need Python 3.11 and SUMO available on your machine.

The easiest way to run project commands is the interactive VROOM menu:

```bash
./vroom.sh

# or through make
make vroom
```

Pick option `2` for development or option `3` for the production-style stack. Option `2` runs `make dev`. The menu calls the Makefile targets underneath, so every action is still reproducible as a direct command.

```bash
# same as VROOM menu option 2
make dev

# rebuild manually when Dockerfiles or dependencies changed
make dev-build
```

After startup:

| Service | URL / port | Purpose |
| --- | --- | --- |
| Frontend dashboard | http://localhost:5173 | Main development UI |
| Backend API | http://localhost:8000 | FastAPI service |
| API docs | http://localhost:8000/docs | Swagger/OpenAPI docs |
| SUMO-Web3D | http://localhost:5000 | 3D simulation service |
| SUMO-Web3D Vite client | http://localhost:3000 | Dev client for the simulator |
| Simulator websocket | ws://localhost:5678 | Live simulation updates |
| MySQL | localhost:3310 | Development database, container port 3306 |
| Redis | localhost:6379 | Shared runtime state/cache |

For the production-style stack:

```bash
make prod
```

Production is served through the Nginx gateway on http://localhost. The gateway routes `/` to the frontend, `/api/` to FastAPI, `/map/` to SUMO-Web3D and `/ws-simulator/` to the simulator websocket.

## Architecture

```mermaid
flowchart LR
    user["Browser / user"] --> frontend["Vue dashboard<br/>frontend:5173 or gateway /"]
    frontend --> api["FastAPI backend<br/>backend:8000"]
    frontend --> map["SUMO-Web3D UI<br/>sumo-web3d:5000"]
    frontend -. websocket .-> ws["Simulator websocket<br/>sumo-web3d:5678"]
    api --> mysql["MySQL<br/>3310 -> 3306"]
    api --> redis["Redis<br/>6379"]
    api --> models["RL model checkpoints<br/>backend/rl/models"]
    map --> sumo["SUMO process<br/>Hasselt XL scenario"]
    map --> redis
    sumo --> scenarios["SUMO scenario files<br/>backend/scenarios/hasselt_xl"]
```

The development stack exposes every service directly. The production stack adds `gateway-prod`, an Nginx reverse proxy, and uses production Dockerfiles for backend, frontend and SUMO-Web3D.

```mermaid
flowchart TB
    subgraph dev["Development compose"]
        devfe["frontend<br/>Vite + HMR"]
        devbe["backend<br/>Uvicorn reload"]
        devsumo["sumo-web3d<br/>Python server + Vite"]
        devdb["mysql"]
        devredis["redis"]
    end

    subgraph prod["Production compose"]
        gateway["gateway-prod<br/>Nginx :80"]
        prodfe["frontend<br/>Nginx static build"]
        prodbe["backend<br/>FastAPI production image"]
        prodsumo["sumo-web3d<br/>production server"]
        proddb["mysql-prod"]
        prodredis["redis-prod"]
    end

    gateway --> prodfe
    gateway --> prodbe
    gateway --> prodsumo
```

## Communicating Traffic Lights & C++ Performance Optimization

The project features a modular, scalable architecture supporting advanced traffic management:

### 1. Communicating Intersections
Intersections communicate peer-to-peer and via a centralized network Registry using a unified [CommunicationManager](file:///c:/Projecten/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/backend/rl/core/vroom_architecture.py). Traffic lights exchange:
- Queue status & vehicles counting.
- Priority vehicle detections (emergency services/public transit).
- Incident detections (stalled vehicles, high delays).
- Predicted inflow trends.
Neighboring traffic lights adapt their pressures and adjust green-wave offsets accordingly.

### 2. C++ Performance Optimization
Heavy flow forecasting, exponential smoothing, green wave offset computations, and sigmoidal queue spillback probability checks are offloaded to a high-performance C++ module [prediction_engine.cpp](file:///c:/Projecten/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/backend/rl/core/prediction_engine.cpp).
- Compiled on container/app startup using [compile_cpp.py](file:///c:/Projecten/VROOM-Vehicle-aware-Regulation-for-Optimized-Orchestration-of-urban-Mobility/backend/rl/core/compile_cpp.py).
- Bound dynamically in Python via `ctypes`.
- Automatically falls back to a pure-Python implementation if a C++ compiler is not present.

## Repository Structure

```text
.
|-- .github/workflows/       # CI, CD, security scan, tagging and PR helper workflows
|-- backend/                 # FastAPI app, database models, RL code and SUMO scenarios
|   |-- app/                 # API routes, auth, config, database sessions and tests
|   |-- rl/                  # DQN agent, SUMO environment, training and evaluation scripts
|   |-- scenarios/hasselt_xl # SUMO network, route files, profiles and generated outputs
|   `-- Dockerfile.*         # dev, prod and training images
|-- frontend/                # Vue dashboard, Pinia stores, Vitest tests and UI components
|-- sumo-web3d/              # SUMO/Three.js simulator service and 3D viewer
|-- database/schema.sql      # MySQL schema loaded by Docker Compose
|-- scripts/                 # Local helper scripts used by VROOM menu, Makefile and manual checks
|-- docker-compose.yml       # Development stack
|-- docker-compose.prod.yml  # Production-style stack with gateway
|-- nginx.gateway.conf       # Production reverse proxy routes
`-- Makefile                 # Direct command shortcuts used by vroom.sh
```

## VROOM Menu and Makefile Commands

Most day-to-day work starts from `./vroom.sh`. It is the control center for the project and maps menu choices to Makefile targets. Use the Makefile commands directly when you want a non-interactive command for CI, scripts or terminal history.

| Menu option | Label | Runs |
| --- | --- | --- |
| `1` | Build Setup | `make setup` |
| `2` | Start Development | `make dev` |
| `3` | Start Production | `make prod` |
| `4` | Live Health Dashboard | `make dashboard` |
| `5` | Bekijk Live Logs | `make logs` |
| `6` | API Status Check | `make status` |
| `7` | Start AI Training | `make train` |
| `8` | Evalueer AI Model | `make eval` |
| `9` | Volledige CI Test | `make test` |
| `10` | Code Quality Check | `make quality` |
| `11` | VROOM System Doctor | `make doctor` |
| `12` | Backup DB & Models | `make backup` |
| `13` | Restore Last Backup | `make restore` |
| `14` | Docker System Prune | `make prune` |
| `15` | Stop alle services | `make stop` |
| `16` | Hard Clean / Reset | `make clean` |
| `17` | Test Backend Only | `make test-backend` |
| `18` | Test Frontend Only | `make test-frontend` |
| `19` | Frontend Watch Mode | `make test-frontend-watch` |
| `20` | Frontend UI Mode | `make test-frontend-ui` |
| `21` | Validate CI Config | `ls .github/workflows/*.yml | xargs -n1 npx -y yaml-validator` |
| `22` | Test PR Labeler | `cat .github/labeler.yml` and prints the local labeler-test tip |
| `23` | Simulation Full CI | prints a CI simulation message, then runs `make ci` |
| `24` | Build Training Image | `make build-train` |

Direct Makefile shortcuts:

| Command | What it does |
| --- | --- |
| `make setup` | Builds Docker images without cache and runs the backend initial setup command. |
| `make dev` | Stops conflicting stacks and starts the development compose stack without rebuilding. |
| `make dev-build` | Rebuilds and starts the development stack. Use this after dependency or Dockerfile changes. |
| `make prod` | Starts the production-style stack using `docker-compose.prod.yml`. |
| `make stop` | Stops both development and production compose stacks. |
| `make logs` | Follows logs from the development compose stack. |
| `make status` | Shows container status and checks `http://localhost:8000/health`. |
| `make dashboard` | Prints the useful dashboard/API URLs. |
| `make test` | Runs backend and frontend tests. |
| `make test-backend` | Runs `pytest` inside the backend container with coverage. |
| `make test-frontend` | Runs `npm run test:unit` in `frontend`. |
| `make test-frontend-watch` | Runs frontend unit tests in watch mode. |
| `make test-frontend-ui` | Runs the Vitest UI mode. |
| `make quality` | Runs the project quality script when available. |
| `make ci` | Runs quality and tests, then checks backend coverage against 80%. |
| `make build-train` | Builds the dedicated training image from `backend/Dockerfile.train`. |
| `make train` | Starts the interactive local training script `scripts/09_run-training.sh`. |
| `make eval` | Runs `scripts/09b_evaluate-model.sh` when present, otherwise falls back to `python -m rl.evaluate` in the backend container. |
| `make doctor` | Runs environment checks through `scripts/doctor.sh` if it exists. |
| `make clean` | Stops stacks and prunes Docker networks/containers. |
| `make prune` | Runs `docker system prune -f`. |
| `make backup` | Dumps the production MySQL database into `backups/`. |
| `make restore` | Restores the newest SQL backup into `mysql-prod`. |

Current caveats from `vroom.sh`/`Makefile`:

- Option `1` runs `make setup`, which currently builds the Docker stack and then calls `python -m app.initial_setup` inside the backend container. That module is not present in the repository right now, so use `make dev-build` when you only need a clean rebuild.
- Option `22` runs `cat .github/labeler.yml`, but that file is not present right now. The option is only useful once a labeler config is added.

Menu-style entry points:

```bash
make init   # runs init-vroom.sh
make vroom  # runs vroom.sh
```

## Training and Evaluation

The active training flow is local-first. Use the VROOM menu and choose option `7`, or run the Makefile target directly:

```bash
./vroom.sh
make train
```

This runs `scripts/09_run-training.sh`, which sets `PYTHONPATH` to `backend`, looks for existing checkpoints in `backend/rl/models`, and lets you choose:

| Option | Meaning |
| --- | --- |
| Fresh training | Start a new model from scratch, default 500 episodes. |
| Continue latest | Resume from the newest `dqn_universal_*_final.pt` checkpoint if one exists. |
| Continue best | Resume from `backend/rl/models/dqn_universal_best.pt`. |
| Custom | Choose episode count, checkpoint and optional epsilon override. |

The underlying command is `python backend/rl/train_local.py`. Useful direct examples:

```bash
# from the repository root
$env:PYTHONPATH = "$PWD/backend"   # PowerShell
python backend/rl/train_local.py --episodes 500 --fresh
python backend/rl/train_local.py --episodes 500 --load backend/rl/models/dqn_universal_best.pt

# Linux/macOS/Git Bash equivalent
export PYTHONPATH="$(pwd)/backend"
python backend/rl/train_local.py --episodes 500 --fresh
```

Evaluation uses `backend/rl/evaluate.py` and compares model output with stored simulation results/baselines where configured:

```bash
make eval

# direct example
$env:PYTHONPATH = "$PWD/backend"
python backend/rl/evaluate.py --model backend/rl/models/dqn_universal_best.pt --episodes 5 --compare
```

The current SUMO environment exposes a 48-feature observation vector and an 8-action traffic-light action space. The code lives in `backend/rl/sumo_env.py` and `backend/rl/dqn_agent.py`.

## Docker and Containers

Development compose (`docker-compose.yml`) starts:

| Container | Image/build | Notes |
| --- | --- | --- |
| `mysql` | `mysql:8.4` | Database `vroomdb`, exposed on `3310`, initialized with `database/schema.sql`. |
| `redis` | `redis:alpine` | Exposed on `6379`. |
| `backend` | `backend/Dockerfile.dev` | FastAPI on `8000`, source mounted for reload. |
| `sumo-web3d` | `sumo-web3d/Dockerfile.dev` | Ports `3000`, `5000`, `5678`; mounts scenarios and models. |
| `frontend` | `frontend/Dockerfile.dev` | Vite dev server on `5173`, source mounted for HMR. |

Production compose (`docker-compose.prod.yml`) starts:

| Container | Image/build | Notes |
| --- | --- | --- |
| `gateway-prod` | `nginx:alpine` | Public entry point on port `80`. |
| `mysql-prod` | `mysql:8.4` | Database `mydatabase`, exposed on `3310`. |
| `redis-prod` | `redis:alpine` | Internal Redis with healthcheck. |
| `backend` | `backend/Dockerfile.prod` | FastAPI production image with healthcheck. |
| `sumo-web3d-prod` | `sumo-web3d/Dockerfile.prod` | Simulator service with scenario/model volumes. |
| `frontend` | `frontend/Dockerfile.prod` | Static production build served by Nginx. |

One important detail: the development database is named `vroomdb`, while production uses `mydatabase`. The corresponding `DATABASE_URL` values are set in the compose files.

## API Overview

The backend registers these route groups:

| Area | Main endpoints |
| --- | --- |
| System | `GET /health` |
| Auth | `POST /register`, `POST /login`, `POST /logout`, `GET /me` |
| Users | `GET /users/me`, `PUT /users/update` |
| Presets | `POST /presets`, `GET /presets`, `PUT /presets/{id}`, `DELETE /presets/{id}` |
| Simulations | `POST /simulations/`, `GET /simulations/`, `DELETE /simulations/{id}` |
| RL | `/rl/training/*`, `/rl/inference/*`, `/rl/models`, `/rl/simulation/status` |

Use `http://localhost:8000/docs` while developing; it is the easiest way to verify request and response shapes.

## DevOps

The GitHub Actions workflows are part of the project workflow:

| Workflow | Trigger | What it checks |
| --- | --- | --- |
| `CI.yml` | Push/PR to `develop` or `main` | Backend tests with coverage, frontend unit tests with coverage, production Docker builds. |
| `CD.yml` | Push to `main` | Builds and pushes backend, frontend, SUMO-Web3D and training images to DockerHub, then updates badges from the latest CI artifacts. |
| `security.yml` | Push/PR to `develop` or `main` | Bandit for Python, npm audit/ESLint for frontend and Trivy filesystem scanning. |
| `tagging.yml` | Release/version workflow | Project version tagging. |
| `pr-description-helper.yml` | Pull request workflow | Helps keep PR descriptions consistent. |

CI currently uses Python 3.11 and Node 20. Backend coverage is checked with `pytest --cov=app --cov=baseline --cov-fail-under=80`. Frontend coverage comes from Vitest.

## Useful Scripts

| Script | Purpose |
| --- | --- |
| `scripts/01_setup-dev.sh` | Development setup helper. |
| `scripts/02_check-quality.sh` | Docker-based quality/security checks. |
| `scripts/03_run-tests.sh` | Docker-based backend and frontend test runner. |
| `scripts/03b_run-tests-docker.sh` | Extra Docker test flow. |
| `scripts/04_check-ci.sh` | Local CI-style checks. |
| `scripts/05_test-cd.sh` | CD workflow helper/check. |
| `scripts/06_run-app.sh` | App startup helper. |
| `scripts/07_verify-api.sh` | API and service verification. |
| `scripts/08_inspect-logs.sh` | Log inspection helper. |
| `scripts/09_run-training.sh` | Interactive RL training manager. |
| `scripts/09b_evaluate-model.sh` | Model evaluation helper. |
| `scripts/10_debug-sumo.sh` | SUMO debugging helper. |
| `scripts/11_stop-app.sh` | Stop helper. |
| `scripts/12_clean-docker.sh` | Docker cleanup helper. |
| `scripts/doctor.sh` | Environment diagnostics. |
| `scripts/backup-data.sh` | Data backup helper. |

## Component Docs

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [SUMO-Web3D README](sumo-web3d/README.md)
- [Nginx gateway config](nginx.gateway.conf)
