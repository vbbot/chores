import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chore import ChoreInstance
from app.models.user import User


async def select_fair_assignee(household_id: uuid.UUID, db: AsyncSession) -> uuid.UUID | None:
    members_res = await db.execute(select(User).where(User.household_id == household_id))
    members = members_res.scalars().all()
    if not members:
        return None
    if len(members) == 1:
        return members[0].id

    # Count pending chores assigned to each member to load-balance
    counts_res = await db.execute(
        select(ChoreInstance.assigned_to, func.count(ChoreInstance.id))
        .where(
            ChoreInstance.household_id == household_id,
            ChoreInstance.status == "pending",
            ChoreInstance.assigned_to.is_not(None),
        )
        .group_by(ChoreInstance.assigned_to)
    )
    counts_map = dict(counts_res.all())

    # Pick member with fewest active tasks
    sorted_members = sorted(members, key=lambda m: counts_map.get(m.id, 0))
    return sorted_members[0].id
