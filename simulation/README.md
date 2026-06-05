# Simulation

The SUMO/Web3D simulation implementation lives in `sumo-web3d/`, with scenario files shared from `backend/scenarios/hasselt_xl`.

This folder is an architectural index for reviewers who expect a top-level simulation entry point. Keeping the runtime code in `sumo-web3d/` avoids breaking the existing Dockerfiles, compose files, Vite config and simulator server layout.

Main implementation:

- `sumo-web3d/`
- `backend/scenarios/hasselt_xl/`
- `backend/rl/sumo_env.py`
