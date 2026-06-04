from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

connect_args = {}

# Engine aanmaken met geoptimaliseerde connection pooling
engine = create_engine(
    DATABASE_URL, 
    echo=False, 
    connect_args=connect_args,
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True
)

# Session generator voor dependency injection
def get_session():
    with Session(engine) as session:
        yield session

# Database tabellen aanmaken met retry loop
def create_db_and_tables():
    import time
    from sqlalchemy.exc import OperationalError
    from sqlalchemy import inspect, text
    
    max_retries = 10
    retry_wait = 2
    
    for i in range(max_retries):
        try:
            # 1. Maak tabellen aan die nog niet bestaan
            SQLModel.metadata.create_all(engine)
            
            # 2. Handmatige migraties
            with Session(engine) as session:
                inspector = inspect(engine)
                
                # Check simulation_presets
                columns_presets = [c['name'] for c in inspector.get_columns('simulation_presets')]
                if 'delay_ms' not in columns_presets:
                    print("🔧 Migrating database: adding delay_ms to simulation_presets...", flush=True)
                    # Omit AFTER clause for SQLite compatibility
                    session.execute(text("ALTER TABLE simulation_presets ADD COLUMN delay_ms INT NOT NULL DEFAULT 30"))
                    session.commit()
                    print("✅ Migration simulation_presets successful.", flush=True)
                
                # Check simulation_results
                columns_results = [c['name'] for c in inspector.get_columns('simulation_results')]
                if 'model_name' not in columns_results:
                    print("🔧 Migrating database: adding model_name to simulation_results...", flush=True)
                    session.execute(text("ALTER TABLE simulation_results ADD COLUMN model_name VARCHAR(255) DEFAULT 'N/A'"))
                    session.commit()
                if 'network' not in columns_results:
                    print("🔧 Migrating database: adding network to simulation_results...", flush=True)
                    session.execute(text("ALTER TABLE simulation_results ADD COLUMN network VARCHAR(255) DEFAULT 'Hasselt XL'"))
                    session.commit()
                if 'avg_speed' not in columns_results:
                    print("🔧 Migrating database: adding avg_speed to simulation_results...", flush=True)
                    session.execute(text("ALTER TABLE simulation_results ADD COLUMN avg_speed FLOAT DEFAULT 0.0"))
                    session.commit()
                if 'total_vehicles' not in columns_results:
                    print("🔧 Migrating database: adding total_vehicles to simulation_results...", flush=True)
                    session.execute(text("ALTER TABLE simulation_results ADD COLUMN total_vehicles INT DEFAULT 0"))
                    session.commit()
                    print("✅ Migration simulation_results successful.", flush=True)

            print("✅ Database connection established and tables verified.", flush=True)
            return
        except OperationalError as e:
            if i < max_retries - 1:
                print(f"⚠️ Database not ready yet (Attempt {i+1}/{max_retries}). Error: {e}", flush=True)
                print(f"   Waiting {retry_wait}s...", flush=True)
                time.sleep(retry_wait)
            else:
                print("❌ Max retries reached. Database connection failed.", flush=True)
                raise e
