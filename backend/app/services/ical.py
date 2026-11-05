from datetime import datetime, time
from icalendar import Calendar, Event

from app.models.bill import Bill
from app.models.bin_collection import BinSchedule
from app.models.chore import ChoreInstance


def generate_chores_ical(chores: list[tuple[ChoreInstance, str]]) -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//ChoreSync//Household Management//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "ChoreSync Chores")

    for instance, template_name in chores:
        event = Event()
        event.add("summary", f"Chore: {template_name}")
        event.add("dtstart", instance.due_date)
        event.add("dtend", instance.due_date)
        event.add("description", f"Status: {instance.status}")
        event.add("uid", f"chore-{instance.id}@choresync")
        cal.add_component(event)

    return cal.to_ical()


def generate_bins_ical(bins: list[tuple[BinSchedule, list]]) -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//ChoreSync//Household Management//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "ChoreSync Bins")

    for schedule, dates in bins:
        for col_date in dates:
            event = Event()
            event.add("summary", f"Bin Collection: {schedule.name} ({schedule.colour})")
            event.add("dtstart", col_date)
            event.add("dtend", col_date)
            event.add("description", f"Put out {schedule.colour} bin")
            event.add("uid", f"bin-{schedule.id}-{col_date.isoformat()}@choresync")
            cal.add_component(event)

    return cal.to_ical()


def generate_bills_ical(bills: list[Bill]) -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//ChoreSync//Household Management//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "ChoreSync Bills")

    for bill in bills:
        if not bill.next_due_date:
            continue
        event = Event()
        amount_str = f"£{bill.amount_pence / 100:.2f}" if bill.amount_pence else "Amount unstated"
        event.add("summary", f"Bill Due: {bill.name} ({amount_str})")
        event.add("dtstart", bill.next_due_date)
        event.add("dtend", bill.next_due_date)
        event.add("description", f"Provider: {bill.provider or 'N/A'}")
        event.add("uid", f"bill-{bill.id}@choresync")
        cal.add_component(event)

    return cal.to_ical()
