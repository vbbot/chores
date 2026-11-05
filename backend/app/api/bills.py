import uuid
from calendar import monthrange
from datetime import date, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_household_id
from app.database import get_db
from app.models.bill import Bill
from app.schemas.bill import BillCreate, BillRead, BillUpdate
from app.services.time import london_today

router = APIRouter(prefix="/bills", tags=["bills"])


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def advance_due_date(current: date, frequency: str) -> date | None:
    """Next due date after payment. One-off bills stop being active."""
    match frequency:
        case "weekly":
            return current + timedelta(days=7)
        case "monthly":
            return add_months(current, 1)
        case "quarterly":
            return add_months(current, 3)
        case "yearly":
            return add_months(current, 12)
        case "one_off":
            return None
        case _:
            return add_months(current, 1)


@router.post("", response_model=BillRead)
async def create_bill(
    data: BillCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    bill = Bill(
        household_id=household_id,
        name=data.name.strip(),
        provider=data.provider,
        amount_pence=data.amount_pence,
        frequency=data.frequency,
        due_day=data.due_day,
        payment_method=data.payment_method,
        account_reference=data.account_reference,
        notes=data.notes,
        next_due_date=data.next_due_date,
    )
    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return bill


@router.get("", response_model=list[BillRead])
async def list_bills(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Bill)
        .where(Bill.household_id == household_id, Bill.is_active.is_(True))
        .order_by(Bill.next_due_date.asc().nulls_last())
    )
    return result.scalars().all()


@router.put("/{bill_id}", response_model=BillRead)
async def update_bill(
    bill_id: uuid.UUID,
    data: BillUpdate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Bill).where(Bill.id == bill_id, Bill.household_id == household_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(bill, field, val)

    await db.commit()
    await db.refresh(bill)
    return bill


@router.post("/{bill_id}/pay", response_model=BillRead)
async def mark_bill_paid(
    bill_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Bill).where(Bill.id == bill_id, Bill.household_id == household_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    today = london_today()
    base = max(bill.next_due_date, today) if bill.next_due_date else today
    bill.next_due_date = advance_due_date(base, bill.frequency)
    if bill.next_due_date is None:
        bill.is_active = False

    await db.commit()
    await db.refresh(bill)
    return bill


@router.delete("/{bill_id}")
async def delete_bill(
    bill_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Bill).where(Bill.id == bill_id, Bill.household_id == household_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    await db.delete(bill)
    await db.commit()
    return {"message": "Bill deleted"}
