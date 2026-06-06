# Docker Deployment

This folder documents the production deployment entry points. The actual service Dockerfiles stay next to their code so each component can own its dependencies:

| Component | Dockerfile |
| --- | --- |
| Dashboard | `frontend/Dockerfile.prod` |
| Backend | `backend/Dockerfile.prod` |
| SUMO/Web3D simulation | `sumo-web3d/Dockerfile.prod` |
| Real traffic-light controller development | `production-real-traffic-lights/docker/Dockerfile.dev` |
| Real traffic-light controller production | `production-real-traffic-lights/docker/Dockerfile.prod` |

## Compose Files

| Compose file | Use |
| --- | --- |
| `docker-compose.dev.yml` | Development stack with hot reload. |
| `docker-compose.yml` | Compatibility default for `docker compose up`; mirrors the dev stack. |
| `docker-compose.prod.yml` | Production-style dashboard/backend/SUMO stack behind Nginx. |
| `docker-compose.production-real.yml` | Full product stack with NATS and mocked real-light controller instances. |
| `production-real-traffic-lights/docker-compose.dev.yml` | Real-light controller development smoke stack. |
| `production-real-traffic-lights/docker-compose.prod.yml` | Real-light controller production-style smoke stack. |

## Run

```bash
cp .env.example .env
docker compose -f docker-compose.production-real.yml up --build
```

Open:

| Service | URL |
| --- | --- |
| Gateway dashboard | `http://localhost` |
| Backend through gateway | `http://localhost/api/health` |
| SUMO map through gateway | `http://localhost/map/` |
| NATS monitoring | `http://localhost:8222` |

Keep `.env` out of Git. Use GitHub Actions secrets, Docker secrets or a deployment secret store for real credentials.

For the production-real stack, change `NATS_AUTH_TOKEN` before sharing or deploying the environment.
