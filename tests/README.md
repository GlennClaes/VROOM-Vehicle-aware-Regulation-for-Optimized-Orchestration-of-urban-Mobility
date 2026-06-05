# Tests

Tests are kept close to the code they validate:

| Area | Location | Typical command |
| --- | --- | --- |
| Backend/API/RL | `backend/app/tests` and backend test folders | `make test-backend` |
| Dashboard | `frontend/src/**/__tests__` | `make test-frontend` |
| Real-light controller | `production-real-traffic-lights/tests` | `ctest --test-dir production-real-traffic-lights/build --output-on-failure` |
| Full project | Makefile and CI workflow | `make test` |

The project quality gate remains at 80 percent coverage for backend logic where coverage is enforced.
