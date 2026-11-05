import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_create_event_accepts_utc_timestamp():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"calendar-{uuid.uuid4().hex}@example.com"
        register = await client.post(
            "/api/auth/register",
            json={
                "name": "Calendar User",
                "email": email,
                "password": "SecretPassword123",
                "household_name": "Calendar House",
            },
        )
        assert register.status_code == 200, register.text

        response = await client.post(
            "/api/calendar/events",
            json={"title": "Boiler service", "start_time": "2030-02-20T10:00:00Z"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["title"] == "Boiler service"

        listed = await client.get("/api/calendar/events")
        assert listed.status_code == 200
        assert len(listed.json()) == 1
