# Source Layout

VROOM is split by runtime boundary instead of forcing every component into a single `src` folder:

| Runtime | Folder |
| --- | --- |
| Backend API, database and RL logic | `backend/` |
| Dashboard UI | `frontend/` |
| SUMO/Web3D simulation service | `sumo-web3d/` |
| Real traffic-light controller preparation | `production-real-traffic-lights/` |
| Documentation site | `docs-site/` |

This top-level folder exists as an architectural index for reviewers who expect a classic production project layout.
