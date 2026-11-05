import json
from pywebpush import WebPushException, webpush

from app.config import settings


def send_web_push(subscription_info: dict, payload: dict) -> bool:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return False

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL},
        )
        return True
    except WebPushException:
        return False
