from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.bill import Bill
from app.models.bin_collection import BinSchedule
from app.models.chore import ChoreInstance
from app.models.user import User
from app.services.bins import collection_dates, exceptions_by_schedule
from app.services.ical import generate_bills_ical, generate_bins_ical, generate_chores_ical
from app.services.time import london_today

router = APIRouter(prefix="/ical", tags=["ical"])


async def get_user_by_token(token: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.ical_token == token))
    user = result.scalar_one_or_none()
    if not user or not user.household_id:
        raise HTTPException(status_code=404, detail="Invalid calendar feed token")
    return user


@router.get("/feed/{token}/chores.ics")
async def get_chores_feed(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await get_user_by_token(token, db)
    result = await db.execute(
        select(ChoreInstance)
        .options(selectinload(ChoreInstance.template))
        .where(ChoreInstance.household_id == user.household_id)
    )
    instances = result.scalars().all()
    chore_tuples = [(inst, inst.template.name if inst.template else "Task") for inst in instances]
    content = generate_chores_ical(chore_tuples)
    return Response(content=content, media_type="text/calendar")


@router.get("/feed/{token}/bins.ics")
async def get_bins_feed(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await get_user_by_token(token, db)
    result = await db.execute(
        select(BinSchedule).where(
            BinSchedule.household_id == user.household_id, BinSchedule.is_active.is_(True)
        )
    )
    schedules = result.scalars().all()
    exceptions = await exceptions_by_schedule(db, [s.id for s in schedules])

    today = london_today()
    bins_data = [
        (schedule, collection_dates(schedule, today, exceptions.get(schedule.id, []), weeks=8))
        for schedule in schedules
    ]

    content = generate_bins_ical(bins_data)
    return Response(content=content, media_type="text/calendar")


@router.get("/feed/{token}/bills.ics")
async def get_bills_feed(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await get_user_by_token(token, db)
    result = await db.execute(
        select(Bill).where(
            Bill.household_id == user.household_id, Bill.is_active.is_(True)
        )
    )
    bills = result.scalars().all()
    content = generate_bills_ical(bills)
    return Response(content=content, media_type="text/calendar")
