# Dashboard

The production dashboard implementation lives in `frontend/`.

This folder is an architectural index for reviewers who expect a top-level dashboard entry point. Keeping the Vue source in `frontend/` avoids breaking the existing Dockerfiles, Vite config, tests and GitHub Actions workflows.

Main implementation:

- `frontend/src/views/DashboardView.vue`
- `frontend/src/components/dashboard/`
- `frontend/src/components/tabs/`
- `frontend/src/stores/`
