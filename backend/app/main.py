from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from app.db.session import create_db_and_tables
from app.api.routes import auth
from app.api.routes import users
from app.core.cors import add_cors
from app.api.routes import rl
from app.api.routes import simulations
from app.api.routes import presets
from app.api.routes import real_traffic
from app.services.nats_monitor import NatsMonitorService

# Instantiate background NATS monitor
nats_monitor = NatsMonitorService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 0. Compile C++ prediction engine
    try:
        print("[Startup] Compiling C++ prediction engine...", flush=True)
        from rl.core.compile_cpp import compile_lib
        compile_lib()
    except Exception as e:
        print(f"[Startup] Failed to compile C++ prediction engine: {e}", flush=True)

    # 1. Initialize Database
    create_db_and_tables()
    
    # 2. Pre-load the RL model in a background thread so the first prediction is instant
    import threading
    def _preload_rl():
        try:
            print("[Startup] Starting RL model pre-load...", flush=True)
            from app.api.routes.rl import preload_agent
            preload_agent()
            print("[Startup] RL model pre-load complete.", flush=True)
        except Exception as e:
            print(f"[Startup] RL model pre-load failed (non-fatal): {e}", flush=True)
            import traceback
            traceback.print_exc()

    threading.Thread(target=_preload_rl, daemon=True).start()
    
    # 3. Start NATS Telemetry Monitor background service
    try:
        await nats_monitor.start()
        print("[Startup] NatsMonitorService started successfully.")
    except Exception as e:
        print(f"[Startup] NatsMonitorService start failed: {e}")
    
    yield
    
    # Shutdown NATS monitor
    try:
        await nats_monitor.stop()
    except:
        pass

app = FastAPI(title="Universal Traffic AI API", lifespan=lifespan)

@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy"}

# Voeg CORS toe
add_cors(app)

# Voeg security headers middleware toe
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Voeg auth routes toe
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(rl.router)
app.include_router(simulations.router)
app.include_router(presets.router)
app.include_router(real_traffic.router)

