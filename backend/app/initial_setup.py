from sqlmodel import Session, select
from app.db.session import engine, create_db_and_tables
from app.db.models import User, SimulationPreset
import os

def seed_database():
    print("[Database Setup] Checking if seeding is required...", flush=True)
    with Session(engine) as session:
        # Check if users already exist
        existing_user = session.exec(select(User)).first()
        if existing_user:
            print("[Database Setup] Database already has data. Skipping seed.", flush=True)
            return

        print("[Database Setup] Seeding initial database records...", flush=True)
        # 1. Create admin and traffic engineer users
        # Passwords are bcrypt-hashed versions of 'adminpassword' and 'userpassword'
        admin = User(
            username="vroomadmin",
            email="admin@vroom.municipal.gov",
            hashed_password="$2b$12$R9h/lIPzMRt5m.1K0BvJkO3Z.aP7GZ.vO9V5t0C6kQ0r7lZ5l4gKG",
            disabled=False
        )
        engineer = User(
            username="traffic_engineer",
            email="engineer@vroom.municipal.gov",
            hashed_password="$2b$12$K8d2sB8s/H.mF4VwF9o1J.wK8U3W.tT9V6t1C6kQ0r7lZ5l4gKG",
            disabled=False
        )
        session.add(admin)
        session.add(engineer)
        session.commit()
        session.refresh(admin)

        # 2. Add default presets for the newly created admin user
        preset_dqn = SimulationPreset(
            user_id=admin.id,
            name="Hasselt Peak Hours (DQN)",
            scenario="hasselt_xl",
            strategy="learned",
            update_interval=1,
            sam_model="dqn_universal_best_rush_hour.pt",
            delay_ms=30
        )
        preset_baseline = SimulationPreset(
            user_id=admin.id,
            name="Hasselt Baseline (Static)",
            scenario="hasselt_xl",
            strategy="baseline",
            update_interval=1,
            sam_model=None,
            delay_ms=30
        )
        session.add(preset_dqn)
        session.add(preset_baseline)
        session.commit()
        print("[Database Setup] Seeding completed successfully!", flush=True)

def main():
    print("[Database Setup] Initializing database tables...", flush=True)
    create_db_and_tables()
    seed_database()

if __name__ == "__main__":
    main()
