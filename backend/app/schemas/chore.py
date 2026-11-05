import uuid
from datetime import date, datetime
from pydantic import BaseModel


class ChoreTemplateCreate(BaseModel):
    room_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    frequency: str = "weekly"
    frequency_days: int | None = None
    estimated_minutes: int | None = 15
    priority: str = "medium"


class ChoreTemplateUpdate(BaseModel):
    room_id: uuid.UUID | None = None
    name: str | None = None
    description: str | None = None
    frequency: str | None = None
    frequency_days: int | None = None
    estimated_minutes: int | None = None
    priority: str | None = None
    is_active: bool | None = None


class ChoreTemplateRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    room_id: uuid.UUID | None
    name: str
    description: str | None
    frequency: str
    frequency_days: int | None
    estimated_minutes: int | None
    priority: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChoreInstanceRead(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    household_id: uuid.UUID
    assigned_to: uuid.UUID | None
    completed_by: uuid.UUID | None
    due_date: date
    completed_at: datetime | None
    status: str
    notes: str | None
    template_name: str | None = None
    room_name: str | None = None

    class Config:
        from_attributes = True


class AssignChore(BaseModel):
    assigned_to: uuid.UUID | None


class CompleteChore(BaseModel):
    notes: str | None = None


class SkipChore(BaseModel):
    notes: str | None = None
