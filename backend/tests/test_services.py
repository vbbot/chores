 
import uuid
from datetime import date
from app.models.bin_collection import BinSchedule
from app.services.bins import next_collection
from app.services.scheduler import calculate_next_due_date
from app.services.ical import generate_chores_ical
from app.models.chore import ChoreInstance


def test_calculate_next_due_date():
    today = date(2026, 11, 4)
    weekly = calculate_next_due_date("weekly", None, today)
    assert (weekly - today).days == 7

    biweekly = calculate_next_due_date("biweekly", None, today)
    assert (biweekly - today).days == 14

    custom = calculate_next_due_date("every_n_days", 4, today)
    assert (custom - today).days == 4


def test_bin_collection_next_date():
    today = date(2026, 11, 4)  # Wednesday (weekday 2)
    # Friday bin (weekday 4)
    schedule = BinSchedule(
        id=uuid.uuid4(),
        household_id=uuid.uuid4(),
        bin_type="recycling",
        name="Recycling",
        colour="blue",
        collection_day=4,  # Friday
        frequency="weekly",
        start_date=today,
    )
    next_date = next_collection(schedule, today)
    assert next_date is not None
    assert next_date.weekday() == 4
    assert next_date >= today


def test_ical_feed_generation():
    inst = ChoreInstance(
        id=uuid.uuid4(),
        template_id=uuid.uuid4(),
        household_id=uuid.uuid4(),
        due_date=date(2026, 11, 5),
        status="pending",
    )
    ical_bytes = generate_chores_ical([(inst, "Vacuum Rug")])
    ical_str = ical_bytes.decode("utf-8")
    assert "BEGIN:VCALENDAR" in ical_str
    assert "Vacuum Rug" in ical_str
    assert "END:VCALENDAR" in ical_str
