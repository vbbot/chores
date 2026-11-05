from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery = Celery(
    "choresync",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    timezone="Europe/London",
    enable_utc=True,
    beat_schedule={
        "daily-chores-generation": {
            "task": "app.tasks.chore_tasks.generate_daily_chores_task",
            "schedule": crontab(hour=0, minute=5),
        },
        "daily-bin-reminders-evening": {
            "task": "app.tasks.notification_tasks.send_bin_reminders_task",
            "schedule": crontab(hour=19, minute=0),
        },
    },
)

celery.autodiscover_tasks(["app.tasks.chore_tasks", "app.tasks.notification_tasks"])
