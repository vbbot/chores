import uuid
from datetime import datetime
from pydantic import BaseModel


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    is_pinned: bool = False
    category: str | None = None


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_pinned: bool | None = None
    category: str | None = None


class NoteRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    author_id: uuid.UUID | None
    title: str
    content: str
    is_pinned: bool
    category: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
