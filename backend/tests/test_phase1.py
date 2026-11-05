import uuid
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.bills import advance_due_date
from app.main import app
from app.services.bins import collection_dates, next_collection
from app.services.time import london_today


def schedule(*, day: int, frequency: str = "weekly", start: date | None = None):
    return SimpleNamespace(
        collection_day=day,
        frequency=frequency,
        start_date=start or london_today(),
        is_active=True,
    )


def exception(original: date, action: str, moved_to: date | None = None):
    return SimpleNamespace(
        original_date=original,
        action=action,
        moved_to_date=moved_to,
    )


def test_bins_skip_exception_is_removed():
    today = london_today()
    upcoming = today + timedelta(days=1)

    dates = collection_dates(
        schedule(day=upcoming.weekday(), start=today),
        today,
        [exception(upcoming, "skip")],
        weeks=2,
    )

    assert upcoming not in dates
    assert upcoming + timedelta(days=7) in dates


def test_bins_move_exception_replaces_date():
    today = london_today()
    upcoming = today + timedelta(days=1)
    moved_to = upcoming + timedelta(days=2)

    dates = collection_dates(
        schedule(day=upcoming.weekday(), start=today),
        today,
        [exception(upcoming, "move", moved_to)],
        weeks=2,
    )

    assert upcoming not in dates
    assert moved_to in dates


def test_bins_fortnightly_parity():
    today = london_today()
    first = today + timedelta(days=1)

    dates = collection_dates(
        schedule(day=first.weekday(), frequency="biweekly", start=first),
        today,
        weeks=5,
    )

    assert dates == [first, first + timedelta(days=14), first + timedelta(days=28)]


def test_next_collection_honours_skip():
    today = london_today()
    upcoming = today + timedelta(days=1)
    item = schedule(day=upcoming.weekday(), start=today)

    assert next_collection(item, today) == upcoming
    assert next_collection(item, today, [exception(upcoming, "skip")]) == upcoming + timedelta(days=7)


def test_bill_advance_handles_month_ends():
    assert advance_due_date(date(2030, 1, 31), "monthly") == date(2030, 2, 28)
    assert advance_due_date(date(2030, 11, 30), "quarterly") == date(2031, 2, 28)
    assert advance_due_date(date(2030, 2, 28), "yearly") == date(2031, 2, 28)
    assert advance_due_date(date(2030, 2, 28), "weekly") == date(2030, 3, 7)
    assert advance_due_date(date(2030, 2, 28), "one_off") is None


async def register(client: AsyncClient, label: str) -> str:
    email = f"phase1-{label}-{uuid.uuid4().hex}@example.com"
    response = await client.post(
        "/api/auth/register",
        json={
            "name": f"Phase One {label}",
            "email": email,
            "password": "SecretPassword123",
            "household_name": f"Phase One {label}",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["user"]["id"]


@pytest.mark.asyncio
async def test_bin_api_honours_skip_and_move():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register(client, "bins")
        today = london_today()
        collection_day = (today + timedelta(days=1)).weekday()

        created = await client.post(
            "/api/bins/schedules",
            json={
                "bin_type": "general",
                "name": "General Waste",
                "colour": "black",
                "collection_day": collection_day,
                "frequency": "weekly",
                "start_date": today.isoformat(),
            },
        )
        assert created.status_code == 200, created.text
        schedule_id = created.json()["id"]
        assert created.json()["next_collection"] == (today + timedelta(days=1)).isoformat()

        skipped = await client.post(
            "/api/bins/exceptions",
            json={
                "schedule_id": schedule_id,
                "original_date": (today + timedelta(days=1)).isoformat(),
                "action": "skip",
            },
        )
        assert skipped.status_code == 200, skipped.text

        listed = await client.get("/api/bins/schedules")
        assert listed.status_code == 200
        assert listed.json()[0]["next_collection"] == (today + timedelta(days=8)).isoformat()

        exceptions = await client.get("/api/bins/exceptions")
        assert exceptions.status_code == 200
        assert len(exceptions.json()) == 1

        removed = await client.delete(f"/api/bins/exceptions/{exceptions.json()[0]['id']}")
        assert removed.status_code == 200
        restored = await client.get("/api/bins/schedules")
        assert restored.json()[0]["next_collection"] == (today + timedelta(days=1)).isoformat()


@pytest.mark.asyncio
async def test_bill_payment_advances_or_retires_bill():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register(client, "bills")

        monthly = await client.post(
            "/api/bills",
            json={
                "name": "Council Tax",
                "amount_pence": 8550,
                "frequency": "monthly",
                "next_due_date": "2030-01-15",
            },
        )
        assert monthly.status_code == 200, monthly.text

        paid = await client.post(f"/api/bills/{monthly.json()['id']}/pay")
        assert paid.status_code == 200, paid.text
        assert paid.json()["next_due_date"] == "2030-02-15"

        one_off = await client.post(
            "/api/bills",
            json={
                "name": "Boiler service",
                "frequency": "one_off",
                "next_due_date": "2030-03-01",
            },
        )
        assert one_off.status_code == 200

        retired = await client.post(f"/api/bills/{one_off.json()['id']}/pay")
        assert retired.status_code == 200
        assert retired.json()["is_active"] is False

        listed = await client.get("/api/bills")
        assert [bill["name"] for bill in listed.json()] == ["Council Tax"]


@pytest.mark.asyncio
async def test_rooms_can_be_created_renamed_and_deleted():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await register(client, "rooms")

        created = await client.post(
            "/api/households/rooms",
            json={"name": "Spare bedroom", "room_type": "bedroom"},
        )
        assert created.status_code == 200, created.text
        room_id = created.json()["id"]

        renamed = await client.put(
            f"/api/households/rooms/{room_id}", json={"name": "Guest room"}
        )
        assert renamed.status_code == 200, renamed.text
        assert renamed.json()["name"] == "Guest room"

        household = await client.get("/api/households")
        assert household.json()["rooms"][0]["name"] == "Guest room"

        deleted = await client.delete(f"/api/households/rooms/{room_id}")
        assert deleted.status_code == 200
        household = await client.get("/api/households")
        assert household.json()["rooms"] == []


@pytest.mark.asyncio
async def test_chore_instances_include_overdue_and_can_be_reassigned():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        user_id = await register(client, "chores")
        today = london_today().isoformat()

        template = await client.post(
            "/api/chores/templates",
            json={"name": "Mop kitchen floor", "frequency": "weekly"},
        )
        assert template.status_code == 200, template.text

        pending = await client.get(f"/api/chores/instances?status=pending&due_before={today}")
        assert pending.status_code == 200, pending.text
        assert len(pending.json()) == 1
        instance_id = pending.json()[0]["id"]
        assert pending.json()[0]["assigned_to"] == user_id

        unassigned = await client.post(
            f"/api/chores/instances/{instance_id}/assign",
            json={"assigned_to": None},
        )
        assert unassigned.status_code == 200
        assert unassigned.json()["assigned_to"] is None

        completed = await client.post(
            f"/api/chores/instances/{instance_id}/complete", json={}
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
