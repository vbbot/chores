import secrets
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_household_id, get_current_user
from app.database import get_db
from app.models.household import Household, Room
from app.models.user import User
from app.schemas.auth import UserRead
from app.schemas.household import (
    BulkRoomsCreate,
    HouseholdCreate,
    HouseholdRead,
    HouseholdUpdate,
    JoinHousehold,
    RoomCreate,
    RoomRead,
    RoomUpdate,
)

router = APIRouter(prefix="/households", tags=["households"])


@router.post("", response_model=HouseholdRead)
async def create_household(
    data: HouseholdCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    household = Household(
        name=data.name.strip(),
        house_type=data.house_type,
        invite_code=secrets.token_hex(4).upper(),
    )
    db.add(household)
    await db.flush()

    current_user.household_id = household.id
    current_user.role = "admin"
    await db.commit()
    await db.refresh(household)
    return household


@router.get("", response_model=HouseholdRead)
async def get_current_household(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Household)
        .options(selectinload(Household.rooms))
        .where(Household.id == household_id)
    )
    household = result.scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return household


@router.put("", response_model=HouseholdRead)
async def update_household(
    data: HouseholdUpdate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Household)
        .options(selectinload(Household.rooms))
        .where(Household.id == household_id)
    )
    household = result.scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")

    if data.name is not None:
        household.name = data.name.strip()
    if data.house_type is not None:
        household.house_type = data.house_type

    await db.commit()
    await db.refresh(household)
    return household


@router.post("/join", response_model=HouseholdRead)
async def join_household(
    data: JoinHousehold,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Household).where(Household.invite_code == data.invite_code.strip())
    )
    household = result.scalar_one_or_none()
    if not household:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    current_user.household_id = household.id
    current_user.role = "member"
    await db.commit()
    await db.refresh(household)
    return household


@router.get("/members", response_model=list[UserRead])
async def list_members(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.household_id == household_id))
    return result.scalars().all()


@router.post("/rooms", response_model=RoomRead)
async def create_room(
    data: RoomCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    room = Room(
        household_id=household_id,
        name=data.name.strip(),
        room_type=data.room_type,
        floor=data.floor,
        sort_order=data.sort_order,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.post("/rooms/bulk", response_model=list[RoomRead])
async def create_rooms_bulk(
    data: BulkRoomsCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    created_rooms = []
    for r in data.rooms:
        room = Room(
            household_id=household_id,
            name=r.name.strip(),
            room_type=r.room_type,
            floor=r.floor,
            sort_order=r.sort_order,
        )
        db.add(room)
        created_rooms.append(room)
    await db.commit()
    for room in created_rooms:
        await db.refresh(room)
    return created_rooms


@router.put("/rooms/{room_id}", response_model=RoomRead)
async def update_room(
    room_id: uuid.UUID,
    data: RoomUpdate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Room).where(Room.id == room_id, Room.household_id == household_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "name" and value is not None:
            value = value.strip()
        setattr(room, field, value)

    await db.commit()
    await db.refresh(room)
    return room


@router.delete("/rooms/{room_id}")
async def delete_room(
    room_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Room).where(Room.id == room_id, Room.household_id == household_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    await db.delete(room)
    await db.commit()
    return {"message": "Room deleted"}

