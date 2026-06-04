from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional

from app.db.session import get_session
from app.db.models import SimulationPreset, User
from app.core.security import get_current_user
from app.schemas.preset import PresetCreate, PresetUpdate, PresetResponse

router = APIRouter(tags=["Presets"])

@router.post("/presets", response_model=PresetResponse)
def create_preset(
    preset_data: PresetCreate,
    current: tuple = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    user, _ = current
    
    db_preset = SimulationPreset(
        user_id=user.id,
        name=preset_data.name,
        scenario=preset_data.scenario,
        strategy=preset_data.strategy,
        update_interval=preset_data.update_interval,
        sam_model=preset_data.sam_model
    )
    
    session.add(db_preset)
    session.commit()
    session.refresh(db_preset)
    return db_preset

@router.get("/presets", response_model=List[PresetResponse])
def get_presets(
    scenario: Optional[str] = None,
    current: tuple = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    user, _ = current
    statement = select(SimulationPreset).where(SimulationPreset.user_id == user.id)
    
    if scenario:
        statement = statement.where(SimulationPreset.scenario == scenario)
        
    presets = session.exec(statement).all()
    return presets

@router.put("/presets/{preset_id}", response_model=PresetResponse)
def update_preset(
    preset_id: int,
    preset_data: PresetUpdate,
    current: tuple = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    user, _ = current
    db_preset = session.get(SimulationPreset, preset_id)
    
    if not db_preset or db_preset.user_id != user.id:
        raise HTTPException(status_code=404, detail="Preset niet gevonden")
    
    if preset_data.name is not None:
        db_preset.name = preset_data.name
    if preset_data.strategy is not None:
        db_preset.strategy = preset_data.strategy
    if preset_data.update_interval is not None:
        db_preset.update_interval = preset_data.update_interval
    if preset_data.sam_model is not None:
        db_preset.sam_model = preset_data.sam_model
        
    session.add(db_preset)
    session.commit()
    session.refresh(db_preset)
    return db_preset

@router.delete("/presets/{preset_id}")
def delete_preset(
    preset_id: int,
    current: tuple = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    user, _ = current
    db_preset = session.get(SimulationPreset, preset_id)
    
    if not db_preset or db_preset.user_id != user.id:
        raise HTTPException(status_code=404, detail="Preset niet gevonden")
    
    session.delete(db_preset)
    session.commit()
    return {"message": "Preset verwijderd"}
