import uuid
from typing import Annotated
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushSubscriptionSchema(BaseModel):
    endpoint: str
    keys: dict


@router.get("")
async def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
    )
    return result.scalars().all()


@router.post("/read-all")
async def mark_all_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id, Notification.is_read.is_(False)
        )
    )
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.post("/push/subscribe")
async def subscribe_push(
    subscription: PushSubscriptionSchema,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    current_user.push_subscription = subscription.model_dump()
    await db.commit()
    return {"message": "Push notifications subscribed"}
