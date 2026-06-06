# 🚦 VROOM TRAFFIC AI - MAKEFILE 🚦

.PHONY: setup local-setup dev prod prod-real real-controller-build real-controller-test real-controller-docker-test stop logs status clean prune train eval test test-backend test-frontend dashboard backup restore doctor vroom init fix-perms

# --- INTERACTIVE ---

vroom:
	@chmod +x vroom.sh
	./vroom.sh

init:
	@chmod +x init-vroom.sh
	./init-vroom.sh

# --- BUILD & START ---

setup:
	@echo "🚀 Setting up VROOM environment..."
	docker compose -f docker-compose.dev.yml build --no-cache
	docker compose -f docker-compose.dev.yml run --rm backend python -m app.initial_setup

local-setup:
	@echo "🚀 Setting up local database and environment outside Docker..."
	cd backend && python -m app.initial_setup

dev:
	@echo "🛠️ Stopping any conflicting containers..."
	docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
	@echo "🛠️ Starting Development Environment (Fast)..."
	docker compose -f docker-compose.dev.yml up --remove-orphans

dev-build:
	@echo "🛠️ Stopping any conflicting containers..."
	docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
	@echo "🏗️ Rebuilding and Starting Development Environment..."
	docker compose -f docker-compose.dev.yml up --build --remove-orphans

prod:
	@echo "🛠️ Stopping any conflicting containers..."
	docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
	@echo "🏗️ Starting Production Environment..."
	docker compose -f docker-compose.prod.yml up --build

prod-real:
	@echo "Starting VROOM production-real stack with NATS and mocked real-light controllers..."
	docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.production-real.yml down --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.production-real.yml up --build

real-controller-build:
	cmake -S production-real-traffic-lights -B production-real-traffic-lights/build
	cmake --build production-real-traffic-lights/build

real-controller-test: real-controller-build
	ctest --test-dir production-real-traffic-lights/build --output-on-failure

real-controller-docker-test:
	python scripts/validate_docker_layout.py
	docker build -f production-real-traffic-lights/docker/Dockerfile.prod -t vroom-real-traffic-controller:local-check production-real-traffic-lights
	docker run --rm vroom-real-traffic-controller:local-check --once
	docker compose -f docker-compose.dev.yml config --quiet
	docker compose -f docker-compose.prod.yml config --quiet
	docker compose -f production-real-traffic-lights/docker-compose.dev.yml config --quiet
	docker compose -f production-real-traffic-lights/docker-compose.prod.yml config --quiet
	docker compose -f docker-compose.production-real.yml config --quiet

# --- MONITORING ---

logs:
	@echo "📜 Viewing Live Logs..."
	docker compose -f docker-compose.dev.yml logs -f

status:
	@echo "📊 Checking System Status..."
	docker compose -f docker-compose.dev.yml ps
	@echo "\n--- API Health ---"
	curl -s http://localhost:8000/health || echo "Backend unreachable"

dashboard:
	@echo "📈 Opening Health Dashboard..."
	@echo "Visit: http://localhost:8000/docs for API docs"
	@echo "Visit: http://localhost/dashboard for the main app"

# --- AI & TRAINING ---

build-train:
	@echo "🏗️ Building AI Training Image..."
	docker build -t vroom-training -f backend/Dockerfile.train ./backend

train:
	@echo "🧠 Starting AI Training Pipeline..."
	@if [ -f scripts/09_run-training.sh ]; then \
		chmod +x scripts/09_run-training.sh && ./scripts/09_run-training.sh; \
	else \
		docker compose -f docker-compose.dev.yml exec backend python -m rl.trainer; \
	fi

eval:
	@echo "⚖️ Evaluating AI Model..."
	@if [ -f scripts/09b_evaluate-model.sh ]; then \
		chmod +x scripts/09b_evaluate-model.sh && ./scripts/09b_evaluate-model.sh; \
	else \
		docker compose -f docker-compose.dev.yml exec backend python -m rl.evaluate; \
	fi

# --- TESTING & QUALITY ---

test: test-backend test-frontend

ci: quality test
	@echo "🚀 CI Simulation complete. Checking coverage..."
	docker compose -f docker-compose.dev.yml exec backend pytest --cov=app --cov=rl --cov=baseline --cov-fail-under=80

test-backend:
	@echo "🧪 Running Backend Tests..."
	docker compose -f docker-compose.dev.yml exec backend pytest --cov=app --cov=rl --cov-report=term-missing

test-frontend:
	@echo "🧪 Running Frontend Tests..."
	cd frontend && npm run test:unit

test-frontend-watch:
	cd frontend && npm run test:unit -- --watch

test-frontend-ui:
	cd frontend && npm run test:unit -- --ui

quality:
	@echo "🧹 Running Quality Checks..."
	@if [ -f scripts/02_check-quality.sh ]; then \
		chmod +x scripts/02_check-quality.sh && ./scripts/02_check-quality.sh; \
	else \
		docker compose -f docker-compose.dev.yml exec backend flake8 .; \
		cd frontend && npm run lint; \
	fi

# --- CLEANUP & MAINTENANCE ---

stop:
	@echo "🛑 Stopping all services..."
	docker compose -f docker-compose.dev.yml down --remove-orphans
	docker compose -f docker-compose.prod.yml down --remove-orphans
	docker compose -f docker-compose.production-real.yml down --remove-orphans

clean:
	@echo "🧹 Hard Clean / Reset..."
	docker compose -f docker-compose.prod.yml down --remove-orphans
	docker compose -f docker-compose.dev.yml down --remove-orphans
	docker network prune -f
	docker container prune -f
	@echo "✅ Cleanup complete."

prune:
	@echo "🗑️ Docker System Prune..."
	docker system prune -f

fix-perms:
	@echo "🔐 Fixing file permissions..."
	chmod +x *.sh
	@echo "✅ Permissions updated."

doctor:
	@echo "🩺 Running VROOM System Doctor..."
	@if [ -f scripts/doctor.sh ]; then \
		chmod +x scripts/doctor.sh && ./scripts/doctor.sh; \
	else \
		docker --version; \
		docker compose version; \
		docker ps; \
		echo "Checking Redis connection..."; \
		docker exec -it redis-prod redis-cli ping || echo "Redis unreachable"; \
	fi

# --- BACKUP & RESTORE ---

backup:
	@echo "💾 Creating backup..."
	mkdir -p backups
	docker exec mysql-prod mysqldump -u myuser -pmypassword mydatabase > backups/db_backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ DB Backup saved to backups/ directory."

restore:
	@echo "🔄 Restoring last backup..."
	@ls -t backups/*.sql | head -n1 | xargs -I {} docker exec -i mysql-prod mysql -u myuser -pmypassword mydatabase < {}
	@echo "✅ Last backup restored."
