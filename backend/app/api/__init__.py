from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.bills import router as bills_router
from app.api.bin_collections import router as bins_router
from app.api.calendar_events import router as calendar_router
from app.api.chores import router as chores_router
from app.api.households import router as households_router
from app.api.ical import router as ical_router
from app.api.notes import router as notes_router
from app.api.notifications import router as notifications_router
from app.api.shopping import router as shopping_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(households_router)
api_router.include_router(chores_router)
api_router.include_router(bins_router)
api_router.include_router(bills_router)
api_router.include_router(shopping_router)
api_router.include_router(calendar_router)
api_router.include_router(notes_router)
api_router.include_router(notifications_router)
api_router.include_router(ical_router)
