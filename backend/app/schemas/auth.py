import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    household_name: str | None = None
    invite_code: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    notification_prefs: dict | None = None


class UserRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID | None
    name: str
    email: str
    role: str
    notification_prefs: dict
    ical_token: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
