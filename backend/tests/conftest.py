import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    """Lifespan does not run under ASGITransport, so create tables explicitly."""

    async def create() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        # The pool must not outlive this loop: each test runs in a fresh loop.
        await engine.dispose()

    asyncio.run(create())
    yield
    asyncio.run(engine.dispose())


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
