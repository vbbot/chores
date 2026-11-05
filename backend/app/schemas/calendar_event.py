import uuid
from datetime import datetime
from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    assigned_to: uuid.UUID | None = None
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    all_day: bool = False
    recurrence_rule: str | None = None
    color: str | None = None
    category: str | None = None


class CalendarEventUpdate(BaseModel):
    assigned_to: uuid.UUID | None = None
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    all_day: bool | None = None
    recurrence_rule: str | None = None
    color: str | None = None
    category: str | None = None


class CalendarEventRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    created_by: uuid.UUID | None
    assigned_to: uuid.UUID | None
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime | None
    all_day: bool
    recurrence_rule: str | None
    color: str | None
    category: str | None
    created_at: datetime

    class Config:
        from_attributes = True
