from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
from sqlalchemy.dialects.mysql import LONGTEXT
from typing import Optional
from datetime import datetime

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    disabled: Optional[bool] = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_login_at: Optional[datetime] = Field(default=None)

class SimulationResult(SQLModel, table=True):
    __tablename__ = "simulation_results"
    id: Optional[int] = Field(default=None, primary_key=True)
    strategy: str  # e.g., "AI Adaptive", "Baseline (Fixed)"
    model_name: Optional[str] = Field(default="N/A")
    scenario: str  # e.g., "rush_hour", "normal"
    network: Optional[str] = Field(default="Hasselt XL")
    date_time: datetime = Field(default_factory=datetime.now)
    avg_queue: float
    avg_speed: float = Field(default=0.0)
    avg_wait_time: float
    teleports: int
    throughput: int
    total_vehicles: int
    total_steps: int
    data_points: str = Field(sa_column=Column(Text().with_variant(LONGTEXT, "mysql"))) # Maximale opslagcapaciteit

class SimulationPreset(SQLModel, table=True):
    __tablename__ = "simulation_presets"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str
    scenario: str
    strategy: str
    update_interval: int
    delay_ms: int = Field(default=30)
    sam_model: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
