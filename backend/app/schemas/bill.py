import uuid
from datetime import date, datetime
from pydantic import BaseModel


class BillCreate(BaseModel):
    name: str
    provider: str | None = None
    amount_pence: int | None = None
    frequency: str = "monthly"
    due_day: int | None = None
    payment_method: str | None = None
    account_reference: str | None = None
    notes: str | None = None
    next_due_date: date | None = None


class BillUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    amount_pence: int | None = None
    frequency: str | None = None
    due_day: int | None = None
    payment_method: str | None = None
    account_reference: str | None = None
    notes: str | None = None
    next_due_date: date | None = None
    is_active: bool | None = None


class BillRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    name: str
    provider: str | None
    amount_pence: int | None
    frequency: str
    due_day: int | None
    payment_method: str | None
    account_reference: str | None
    notes: str | None
    next_due_date: date | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
