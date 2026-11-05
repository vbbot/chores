import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_household_id, get_current_user
from app.database import get_db
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteCreate, NoteRead, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
async def list_notes(
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Note)
        .where(Note.household_id == household_id)
        .order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=NoteRead)
async def create_note(
    data: NoteCreate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    note = Note(
        household_id=household_id,
        author_id=current_user.id,
        title=data.title.strip(),
        content=data.content,
        is_pinned=data.is_pinned,
        category=data.category,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: uuid.UUID,
    data: NoteUpdate,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.household_id == household_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(note, field, val)

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}")
async def delete_note(
    note_id: uuid.UUID,
    household_id: Annotated[uuid.UUID, Depends(get_current_household_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.household_id == household_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.commit()
    return {"message": "Note deleted"}
