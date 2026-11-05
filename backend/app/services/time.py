from datetime import date, datetime
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")


def london_now() -> datetime:
    return datetime.now(LONDON)


def london_today() -> date:
    """Today in the household timezone, not the container's UTC date."""
    return london_now().date()
