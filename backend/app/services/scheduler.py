from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chore import ChoreInstance, ChoreTemplate
from app.services.delegation import select_fair_assignee
from app.services.time import london_today


def calculate_next_due_date(frequency: str, frequency_days: int | None, from_date: date) -> date:
    match frequency:
        case "daily":
            return from_date
        case "every_n_days":
            return from_date + timedelta(days=frequency_days or 3)
        case "weekly":
            return from_date + timedelta(days=7)
        case "biweekly":
            return from_date + timedelta(days=14)
        case "monthly":
            return from_date + timedelta(days=30)
        case "quarterly":
            return from_date + timedelta(days=90)
        case "yearly":
            return from_date + timedelta(days=365)
        case _:
            return from_date + timedelta(days=7)


async def generate_chore_instances_for_today(db: AsyncSession) -> int:
    today = london_today()
    templates_res = await db.execute(
        select(ChoreTemplate).where(ChoreTemplate.is_active.is_(True))
    )
    templates = templates_res.scalars().all()
    created_count = 0

    for template in templates:
        # Check if an instance already exists for today or future pending
        existing = await db.execute(
            select(ChoreInstance).where(
                ChoreInstance.template_id == template.id,
                ChoreInstance.due_date >= today,
                ChoreInstance.status == "pending",
            )
        )
        if existing.scalar_one_or_none():
            continue

        assignee = await select_fair_assignee(template.household_id, db)
        instance = ChoreInstance(
            template_id=template.id,
            household_id=template.household_id,
            assigned_to=assignee,
            due_date=today,
            status="pending",
        )
        db.add(instance)
        created_count += 1

    await db.commit()
    return created_count
