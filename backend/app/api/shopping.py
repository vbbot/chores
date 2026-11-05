import uuid
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_household_id, get_current_user
from app.database import get_db
from app.models.shopping import ShoppingItem, ShoppingList
from app.models.user import User
from app.schemas.shopping import (
    ShoppingItemCreate,
    ShoppingItemRead,
    ShoppingItemUpdate,
    ShoppingListCreate,
    ShoppingListRead,
)

router = APIRouter(prefix="/shopping", tags=["shopping"])


async def load_list(db: AsyncSession, list_id: uuid.UUID) -> ShoppingList:
    result = await db.execute(
        select(ShoppingList)
        .options(selectinload(ShoppingList.items))
        .where(ShoppingList.id == list_id)
    )
    return result.scalar_one()


@router.get("/lists", response_model=list[ShoppingListRead])
async def list_shopping_lists(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShoppingList)
        .options(selectinload(ShoppingList.items))
        .where(ShoppingList.household_id == household_id, ShoppingList.is_active.is_(True))
    )
    lists = result.scalars().all()
    if not lists:
        default_list = ShoppingList(household_id=household_id, name="Groceries")
        db.add(default_list)
        await db.commit()
        return [await load_list(db, default_list.id)]
    return lists


@router.post("/lists", response_model=ShoppingListRead)
async def create_shopping_list(
    data: ShoppingListCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    sh_list = ShoppingList(household_id=household_id, name=data.name.strip())
    db.add(sh_list)
    await db.commit()
    return await load_list(db, sh_list.id)


@router.post("/lists/{list_id}/items", response_model=ShoppingItemRead)
async def add_item(
    list_id: uuid.UUID,
    data: ShoppingItemCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    list_result = await db.execute(
        select(ShoppingList).where(
            ShoppingList.id == list_id,
            ShoppingList.household_id == household_id,
        )
    )
    if not list_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Shopping list not found")

    item = ShoppingItem(
        list_id=list_id,
        added_by=current_user.id,
        name=data.name.strip(),
        category=data.category,
        quantity=data.quantity,
        unit=data.unit,
        notes=data.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=ShoppingItemRead)
async def update_item(
    item_id: uuid.UUID,
    data: ShoppingItemUpdate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShoppingItem)
        .join(ShoppingList, ShoppingItem.list_id == ShoppingList.id)
        .where(
            ShoppingItem.id == item_id,
            ShoppingList.household_id == household_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")

    if data.is_checked is not None:
        item.is_checked = data.is_checked
        item.checked_at = datetime.utcnow() if data.is_checked else None
    if data.name is not None:
        item.name = data.name.strip()
    if data.quantity is not None:
        item.quantity = data.quantity
    if data.category is not None:
        item.category = data.category

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShoppingItem)
        .join(ShoppingList, ShoppingItem.list_id == ShoppingList.id)
        .where(
            ShoppingItem.id == item_id,
            ShoppingList.household_id == household_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Item deleted"}
