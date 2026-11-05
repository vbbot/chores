import uuid
from datetime import datetime
from pydantic import BaseModel


class RoomCreate(BaseModel):
    name: str
    room_type: str = "other"
    floor: int | None = None
    sort_order: int = 0


class RoomUpdate(BaseModel):
    name: str | None = None
    room_type: str | None = None
    floor: int | None = None
    sort_order: int | None = None


class RoomRead(BaseModel):
    id: uuid.UUID
    household_id: uuid.UUID
    name: str
    room_type: str
    floor: int | None
    sort_order: int

    class Config:
        from_attributes = True


class BulkRoomsCreate(BaseModel):
    rooms: list[RoomCreate]


class HouseholdCreate(BaseModel):
    name: str
    house_type: str = "terraced"


class HouseholdUpdate(BaseModel):
    name: str | None = None
    house_type: str | None = None


class HouseholdRead(BaseModel):
    id: uuid.UUID
    name: str
    house_type: str
    invite_code: str
    created_at: datetime
    rooms: list[RoomRead] = []

    class Config:
        from_attributes = True


class JoinHousehold(BaseModel):
    invite_code: str
