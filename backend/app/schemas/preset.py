from sqlmodel import SQLModel
from typing import Optional

class PresetCreate(SQLModel):
    name: str
    scenario: str
    strategy: str
    update_interval: int
    sam_model: Optional[str] = None

class PresetUpdate(SQLModel):
    name: Optional[str] = None
    strategy: Optional[str] = None
    update_interval: Optional[int] = None
    sam_model: Optional[str] = None

class PresetResponse(SQLModel):
    id: int
    name: str
    scenario: str
    strategy: str
    update_interval: int
    sam_model: Optional[str] = None
