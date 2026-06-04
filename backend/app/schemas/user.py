from sqlmodel import SQLModel
from typing import Optional

# ---------------------------
# Request models
# ---------------------------
class UserCreate(SQLModel):
    username: str
    email: str
    password: str

class UserLogin(SQLModel):
    email: str
    password: str

class UserUpdate(SQLModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    current_password: Optional[str] = None

class DeleteAccountRequest(SQLModel):
    current_password: str

# ---------------------------
# Response models
# ---------------------------
class Message(SQLModel):
    message: str

class Token(SQLModel):
    access_token: str
    token_type: str
