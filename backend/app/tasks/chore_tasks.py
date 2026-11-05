import asyncio
from app.database import AsyncSessionLocal
from app.services.scheduler import generate_chore_instances_for_today
from app.tasks.celery_app import celery


@celery.task
def generate_daily_chores_task():
    async def _run():
        async with AsyncSessionLocal() as session:
            return await generate_chore_instances_for_today(session)

    return asyncio.run(_run())
