import asyncio
from datetime import timedelta
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.bin_collection import BinSchedule
from app.models.user import User
from app.services.bins import exceptions_by_schedule, next_collection
from app.services.push import send_web_push
from app.services.time import london_today
from app.tasks.celery_app import celery


@celery.task
def send_bin_reminders_task():
    async def _run():
        today = london_today()
        tomorrow = today + timedelta(days=1)

        async with AsyncSessionLocal() as session:
            schedules_res = await session.execute(
                select(BinSchedule).where(BinSchedule.is_active.is_(True))
            )
            schedules = schedules_res.scalars().all()
            exceptions = await exceptions_by_schedule(
                session, [s.id for s in schedules]
            )

            for schedule in schedules:
                upcoming = next_collection(
                    schedule, today, exceptions.get(schedule.id, [])
                )
                if upcoming != tomorrow:
                    continue

                users_res = await session.execute(
                    select(User).where(User.household_id == schedule.household_id)
                )
                users = users_res.scalars().all()
                for user in users:
                    if user.push_subscription:
                        send_web_push(
                            user.push_subscription,
                            {
                                "title": "Bin Reminder",
                                "body": f"Put out the {schedule.name} ({schedule.colour} bin) tonight.",
                                "url": "/bins",
                            },
                        )

    asyncio.run(_run())
