import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.api.deps import hash_password, verify_password


def test_password_hashing():
    pw = "my-secure-password"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_password_long_bytes():
    # Passwords longer than 72 bytes should not raise ValueError
    long_pw = "a" * 100
    hashed = hash_password(long_pw)
    assert verify_password(long_pw, hashed) is True


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "app": "ChoreSync API"}


@pytest.mark.asyncio
async def test_empty_shopping_list_returns_items():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"shop-{uuid.uuid4().hex}@example.com"
        reg = await client.post(
            "/api/auth/register",
            json={
                "name": "Shopping User",
                "email": email,
                "password": "SecretPassword123",
                "household_name": "Shopping House",
            },
        )
        assert reg.status_code == 200, reg.text

        response = await client.get("/api/shopping/lists")
        assert response.status_code == 200, response.text
        lists = response.json()
        assert len(lists) == 1
        assert lists[0]["items"] == []


@pytest.mark.asyncio
async def test_registration_and_login_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"testuser-{uuid.uuid4().hex}@example.com"
        reg_payload = {
            "name": "Test User",
            "email": email,
            "password": "SecretPassword123",
            "household_name": "Test Cottage",
        }
        res = await client.post("/api/auth/register", json=reg_payload)
        assert res.status_code == 200, res.text

        # Login
        login_res = await client.post(
            "/api/auth/login",
            json={"email": email, "password": "SecretPassword123"},
        )
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["user"]["email"] == email
        assert data["user"]["household_id"] is not None

        # Verify cookie is set
        assert "access_token" in login_res.cookies
