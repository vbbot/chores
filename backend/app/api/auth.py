import secrets
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.household import Household
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLogin, UserRead, UserRegister, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    data: UserRegister,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered",
        )

    household_id = None
    role = "member"

    if data.invite_code:
        hh_result = await db.execute(
            select(Household).where(Household.invite_code == data.invite_code.strip())
        )
        household = hh_result.scalar_one_or_none()
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invite code",
            )
        household_id = household.id
    elif data.household_name:
        new_hh = Household(
            name=data.household_name.strip(),
            house_type="terraced",
            invite_code=secrets.token_hex(4).upper(),
        )
        db.add(new_hh)
        await db.flush()
        household_id = new_hh.id
        role = "admin"

    user = User(
        name=data.name.strip(),
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        household_id=household_id,
        role=role,
        ical_token=secrets.token_urlsafe(24),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id), "household_id": str(household_id) if household_id else None})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == data.email.lower().strip()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(
        {"sub": str(user.id), "household_id": str(user.household_id) if user.household_id else None}
    )
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserRead)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserRead.model_validate(current_user)


@router.put("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if data.name is not None:
        current_user.name = data.name.strip()
    if data.notification_prefs is not None:
        current_user.notification_prefs = data.notification_prefs

    await db.commit()
    await db.refresh(current_user)
    return UserRead.model_validate(current_user)
