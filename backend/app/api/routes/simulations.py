from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from app.db.models import SimulationResult
from app.db.session import get_session
from datetime import datetime

router = APIRouter(prefix="/simulations", tags=["Simulations"])

@router.post("/", response_model=SimulationResult)
def save_simulation_result(result: SimulationResult, session: Session = Depends(get_session)):
    session.add(result)
    session.commit()
    session.refresh(result)
    return result

@router.get("/", response_model=List[SimulationResult])
def list_simulation_results(session: Session = Depends(get_session)):
    statement = select(SimulationResult).order_by(SimulationResult.date_time.desc())
    results = session.exec(statement).all()
    return results

@router.delete("/{result_id}")
def delete_simulation_result(result_id: int, session: Session = Depends(get_session)):
    result = session.get(SimulationResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Simulation result not found")
    session.delete(result)
    session.commit()
    return {"status": "success"}
