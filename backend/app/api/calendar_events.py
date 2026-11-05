import uuid
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_household_id, get_current_user
from app.database import get_db
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventRead,
    CalendarEventUpdate,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


def to_naive_utc(value: datetime | None) -> datetime | None:
    """Columns are TIMESTAMP WITHOUT TIME ZONE, so store UTC without tzinfo."""
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


@router.get("/events", response_model=list[CalendarEventRead])
async def list_events(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.household_id == household_id)
        .order_by(CalendarEvent.start_time.asc())
    )
    return result.scalars().all()


@router.post("/events", response_model=CalendarEventRead)
async def create_event(
    data: CalendarEventCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    event = CalendarEvent(
        household_id=household_id,
        created_by=current_user.id,
        assigned_to=data.assigned_to,
        title=data.title.strip(),
        description=data.description,
        start_time=to_naive_utc(data.start_time),
        end_time=to_naive_utc(data.end_time),
        all_day=data.all_day,
        recurrence_rule=data.recurrence_rule,
        color=data.color,
        category=data.category,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.household_id == household_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.delete(event)
    await db.commit()
    return {"message": "Event deleted"}
