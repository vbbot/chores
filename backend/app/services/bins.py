import uuid
from datetime import date, timedelta
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bin_collection import BinException, BinSchedule

CYCLE_WEEKS = {"weekly": 1, "biweekly": 2, "monthly": 4}


def _is_scheduled(schedule: BinSchedule, day: date) -> bool:
    if day < schedule.start_date:
        return False
    if day.weekday() != schedule.collection_day:
        return False
    cycle = CYCLE_WEEKS.get(schedule.frequency, 1)
    weeks_since_start = (day - schedule.start_date).days // 7
    return weeks_since_start % cycle == 0


def collection_dates(
    schedule: BinSchedule,
    from_date: date,
    exceptions: Iterable[BinException] = (),
    weeks: int = 8,
) -> list[date]:
    """Scheduled collections in the window, after skip/move exceptions."""
    by_original: dict[date, BinException] = {
        exc.original_date: exc for exc in exceptions
    }
    horizon = from_date + timedelta(weeks=weeks)
    dates: list[date] = []
    day = from_date

    while day < horizon:
        if _is_scheduled(schedule, day):
            exception = by_original.get(day)
            if exception is None:
                dates.append(day)
            elif exception.action == "move" and exception.moved_to_date:
                dates.append(exception.moved_to_date)
        day += timedelta(days=1)

    return sorted({d for d in dates if d >= from_date})


def next_collection(
    schedule: BinSchedule,
    from_date: date,
    exceptions: Iterable[BinException] = (),
) -> date | None:
    # 26 weeks covers a moved fortnightly collection plus holidays.
    for weeks in (8, 26):
        dates = collection_dates(schedule, from_date, exceptions, weeks=weeks)
        if dates:
            return dates[0]
    return None


async def exceptions_by_schedule(
    db: AsyncSession, schedule_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[BinException]]:
    if not schedule_ids:
        return {}

    result = await db.execute(
        select(BinException).where(BinException.schedule_id.in_(schedule_ids))
    )
    grouped: dict[uuid.UUID, list[BinException]] = {}
    for exception in result.scalars().all():
        grouped.setdefault(exception.schedule_id, []).append(exception)
    return grouped
