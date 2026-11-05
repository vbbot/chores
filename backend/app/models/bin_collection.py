import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BinSchedule(Base):
    __tablename__ = "bin_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    bin_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # general, recycling, garden, food, glass, other
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    colour: Mapped[str] = mapped_column(String(50), default="black")  # black, blue, green, brown
    collection_day: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # 0=Monday ... 6=Sunday
    frequency: Mapped[str] = mapped_column(
        String(20), default="weekly"
    )  # weekly, biweekly, monthly
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    reminder_offset_hours: Mapped[int] = mapped_column(Integer, default=15)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    exceptions: Mapped[list["BinException"]] = relationship(
        "BinException", back_populates="schedule", cascade="all, delete-orphan"
    )


class BinException(Base):
    __tablename__ = "bin_exceptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bin_schedules.id", ondelete="CASCADE"), nullable=False
    )
    original_date: Mapped[date] = mapped_column(Date, nullable=False)
    action: Mapped[str] = mapped_column(String(20), default="move")  # skip, move
    moved_to_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    schedule: Mapped["BinSchedule"] = relationship("BinSchedule", back_populates="exceptions")
