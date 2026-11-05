import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_household_id
from app.database import get_db
from app.models.bin_collection import BinException, BinSchedule
from app.schemas.bin_collection import (
    BinExceptionCreate,
    BinExceptionRead,
    BinScheduleCreate,
    BinScheduleRead,
)
from app.services.bins import exceptions_by_schedule, next_collection
from app.services.time import london_today

router = APIRouter(prefix="/bins", tags=["bins"])


def read_schedule(schedule: BinSchedule, exceptions: list[BinException]) -> BinScheduleRead:
    read = BinScheduleRead.model_validate(schedule)
    read.next_collection = next_collection(schedule, london_today(), exceptions)
    return read


@router.post("/schedules", response_model=BinScheduleRead)
async def create_schedule(
    data: BinScheduleCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    schedule = BinSchedule(
        household_id=household_id,
        bin_type=data.bin_type,
        name=data.name.strip(),
        colour=data.colour,
        collection_day=data.collection_day,
        frequency=data.frequency,
        start_date=data.start_date,
        reminder_offset_hours=data.reminder_offset_hours,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return read_schedule(schedule, [])


@router.get("/schedules", response_model=list[BinScheduleRead])
async def list_schedules(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(BinSchedule)
        .where(BinSchedule.household_id == household_id)
        .order_by(BinSchedule.collection_day.asc())
    )
    schedules = result.scalars().all()
    exceptions = await exceptions_by_schedule(db, [s.id for s in schedules])
    return [read_schedule(s, exceptions.get(s.id, [])) for s in schedules]


@router.get("/tonight", response_model=list[BinScheduleRead])
async def get_bins_for_tonight(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    today = london_today()
    tomorrow = today + timedelta(days=1)
    result = await db.execute(
        select(BinSchedule).where(
            BinSchedule.household_id == household_id,
            BinSchedule.is_active.is_(True),
        )
    )
    schedules = result.scalars().all()
    exceptions = await exceptions_by_schedule(db, [s.id for s in schedules])

    due_tomorrow = []
    for schedule in schedules:
        upcoming = next_collection(schedule, today, exceptions.get(schedule.id, []))
        if upcoming == tomorrow:
            read = BinScheduleRead.model_validate(schedule)
            read.next_collection = upcoming
            due_tomorrow.append(read)
    return due_tomorrow


@router.post("/exceptions", response_model=BinExceptionRead)
async def create_exception(
    data: BinExceptionCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if data.action not in {"skip", "move"}:
        raise HTTPException(status_code=400, detail="Action must be skip or move")
    if data.action == "move" and data.moved_to_date is None:
        raise HTTPException(status_code=400, detail="A moved collection needs a new date")

    result = await db.execute(
        select(BinSchedule).where(
            BinSchedule.id == data.schedule_id,
            BinSchedule.household_id == household_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Bin schedule not found")

    exception = BinException(
        schedule_id=data.schedule_id,
        original_date=data.original_date,
        action=data.action,
        moved_to_date=data.moved_to_date,
        reason=data.reason,
    )
    db.add(exception)
    await db.commit()
    await db.refresh(exception)
    return exception


@router.get("/exceptions", response_model=list[BinExceptionRead])
async def list_exceptions(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(BinException)
        .join(BinSchedule, BinException.schedule_id == BinSchedule.id)
        .where(BinSchedule.household_id == household_id)
        .order_by(BinException.original_date.asc())
    )
    return result.scalars().all()


@router.delete("/exceptions/{exception_id}")
async def delete_exception(
    exception_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(BinException)
        .join(BinSchedule, BinException.schedule_id == BinSchedule.id)
        .where(
            BinException.id == exception_id,
            BinSchedule.household_id == household_id,
        )
    )
    exception = result.scalar_one_or_none()
    if not exception:
        raise HTTPException(status_code=404, detail="Bin exception not found")

    await db.delete(exception)
    await db.commit()
    return {"message": "Bin exception deleted"}
