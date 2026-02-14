from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.services import greet_user

app = FastAPI()


class GreetRequest(BaseModel):
    name: str


class GreetResponse(BaseModel):
    message: str


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/greet", response_model=GreetResponse)
def greet(request: GreetRequest):
    try:
        message = greet_user(request.name)
        return GreetResponse(message=message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))