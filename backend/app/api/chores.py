import uuid
from datetime import date, datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_household_id, get_current_user
from app.database import get_db
from app.models.chore import ChoreInstance, ChoreTemplate
from app.models.household import Room
from app.models.user import User
from app.schemas.chore import (
    AssignChore,
    ChoreInstanceRead,
    ChoreTemplateCreate,
    ChoreTemplateRead,
    ChoreTemplateUpdate,
    CompleteChore,
    SkipChore,
)
from app.services.delegation import select_fair_assignee
from app.services.time import london_today

router = APIRouter(prefix="/chores", tags=["chores"])


@router.post("/templates", response_model=ChoreTemplateRead)
async def create_template(
    data: ChoreTemplateCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    template = ChoreTemplate(
        household_id=household_id,
        room_id=data.room_id,
        name=data.name.strip(),
        description=data.description,
        frequency=data.frequency,
        frequency_days=data.frequency_days,
        estimated_minutes=data.estimated_minutes,
        priority=data.priority,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    # Automatically create the first instance due today
    assignee = await select_fair_assignee(household_id, db)
    instance = ChoreInstance(
        template_id=template.id,
        household_id=household_id,
        assigned_to=assignee,
        due_date=london_today(),
        status="pending",
    )
    db.add(instance)
    await db.commit()

    return template


@router.get("/templates", response_model=list[ChoreTemplateRead])
async def list_templates(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ChoreTemplate).where(ChoreTemplate.household_id == household_id)
    )
    return result.scalars().all()


@router.get("/instances", response_model=list[ChoreInstanceRead])
async def list_instances(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(None),
    due_date_filter: date | None = Query(None, alias="due_date"),
    due_before: date | None = Query(None),
):
    query = (
        select(ChoreInstance)
        .options(selectinload(ChoreInstance.template))
        .where(ChoreInstance.household_id == household_id)
    )
    if status:
        query = query.where(ChoreInstance.status == status)
    if due_date_filter:
        query = query.where(ChoreInstance.due_date == due_date_filter)
    if due_before:
        query = query.where(ChoreInstance.due_date <= due_before)

    query = query.order_by(ChoreInstance.due_date.asc())
    result = await db.execute(query)
    instances = result.scalars().all()

    rooms_result = await db.execute(
        select(Room).where(Room.household_id == household_id)
    )
    room_names = {room.id: room.name for room in rooms_result.scalars().all()}

    output = []
    for inst in instances:
        read = ChoreInstanceRead.model_validate(inst)
        if inst.template:
            read.template_name = inst.template.name
            if inst.template.room_id:
                read.room_name = room_names.get(inst.template.room_id)
        output.append(read)
    return output


@router.post("/instances/{instance_id}/complete", response_model=ChoreInstanceRead)
async def complete_instance(
    instance_id: uuid.UUID,
    data: CompleteChore,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ChoreInstance).where(
            ChoreInstance.id == instance_id,
            ChoreInstance.household_id == current_user.household_id,
        )
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Chore instance not found")

    instance.status = "completed"
    instance.completed_by = current_user.id
    instance.completed_at = datetime.utcnow()
    if data.notes:
        instance.notes = data.notes

    await db.commit()
    await db.refresh(instance)
    return instance


@router.post("/instances/{instance_id}/skip", response_model=ChoreInstanceRead)
async def skip_instance(
    instance_id: uuid.UUID,
    data: SkipChore,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ChoreInstance).where(
            ChoreInstance.id == instance_id,
            ChoreInstance.household_id == current_user.household_id,
        )
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Chore instance not found")

    instance.status = "skipped"
    if data.notes:
        instance.notes = data.notes

    await db.commit()
    await db.refresh(instance)
    return instance


@router.post("/instances/{instance_id}/assign", response_model=ChoreInstanceRead)
async def assign_instance(
    instance_id: uuid.UUID,
    data: AssignChore,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ChoreInstance).where(
            ChoreInstance.id == instance_id,
            ChoreInstance.household_id == current_user.household_id,
        )
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Chore instance not found")

    if data.assigned_to is not None:
        member_result = await db.execute(
            select(User).where(
                User.id == data.assigned_to,
                User.household_id == current_user.household_id,
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Assignee is not in this household")

    instance.assigned_to = data.assigned_to
    await db.commit()
    await db.refresh(instance)
    return instance
