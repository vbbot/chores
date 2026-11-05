import uuid
from datetime import datetime
from pydantic import BaseModel


class ShoppingItemCreate(BaseModel):
    name: str
    category: str | None = None
    quantity: int = 1
    unit: str | None = None
    notes: str | None = None


class ShoppingItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    quantity: int | None = None
    unit: str | None = None
    notes: str | None = None
    is_checked: bool | None = None


class ShoppingItemRead(BaseModel):
    id: uuid.UUID
    list_id: uuid.UUID
    added_by: uuid.UUID | None
    name: str
    category: str | None
    quantity: int
    unit: str | None
    is_checked: bool
    notes: str | None
    checked_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class ShoppingListCreate(BaseModel):
    name: str


class ShoppingListRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    name: str
    is_active: bool
    created_at: datetime
    items: list[ShoppingItemRead] = []

    class Config:
        from_attributes = True
