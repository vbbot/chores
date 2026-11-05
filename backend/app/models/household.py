import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Household(Base):
    __tablename__ = "households"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    house_type: Mapped[str] = mapped_column(
        String(50), default="terraced"
    )  # flat, terraced, semi-detached, detached, bungalow, other
    invite_code: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    members: Mapped[list["User"]] = relationship(
        "User", back_populates="household", cascade="all, delete-orphan"
    )
    rooms: Mapped[list["Room"]] = relationship(
        "Room", back_populates="household", cascade="all, delete-orphan"
    )


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    room_type: Mapped[str] = mapped_column(
        String(50), default="other"
    )  # kitchen, bathroom, bedroom, living_room, hallway, utility, garden, garage, other
    floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    household: Mapped["Household"] = relationship("Household", back_populates="rooms")
