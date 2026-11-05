import uuid
from datetime import date
from pydantic import BaseModel


class BinScheduleCreate(BaseModel):
    bin_type: str
    name: str
    colour: str = "black"
    collection_day: int
    frequency: str = "weekly"
    start_date: date
    reminder_offset_hours: int = 15


class BinScheduleUpdate(BaseModel):
    bin_type: str | None = None
    name: str | None = None
    colour: str | None = None
    collection_day: int | None = None
    frequency: str | None = None
    start_date: date | None = None
    reminder_offset_hours: int | None = None
    is_active: bool | None = None


class BinScheduleRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    bin_type: str
    name: str
    colour: str
    collection_day: int
    frequency: str
    start_date: date
    reminder_offset_hours: int
    is_active: bool
    next_collection: date | None = None

    class Config:
        from_attributes = True


class BinExceptionCreate(BaseModel):
    schedule_id: uuid.UUID
    original_date: date
    action: str = "move"
    moved_to_date: date | None = None
    reason: str | None = None


class BinExceptionRead(BaseModel):
    id: uuid.UUID
    schedule_id: uuid.UUID
    original_date: date
    action: str
    moved_to_date: date | None
    reason: str | None

    class Config:
        from_attributes = True
