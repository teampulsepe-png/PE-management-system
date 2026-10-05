import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from pywebpush import webpush, WebPushException

from backend.db.session import SessionLocal
from backend.db.models import PushSubscription

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_CONTACT     = os.getenv("VAPID_CONTACT", "mailto:admin@example.com")

_executor = ThreadPoolExecutor(max_workers=4)


def _send_one(endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CONTACT},
        )
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code == 410:
            db = SessionLocal()
            try:
                db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).delete()
                db.commit()
            finally:
                db.close()
        else:
            logger.warning("Push failed for %.40s: %s", endpoint, exc)
    except Exception as exc:
        logger.warning("Push error: %s", exc)


def send_to_emails_sync(emails: list[str], title: str, body: str, url: str = "/") -> None:
    """Synchronous — safe to call from FastAPI BackgroundTasks."""
    if not VAPID_PRIVATE_KEY or not emails:
        return
    db = SessionLocal()
    try:
        subs = (
            db.query(PushSubscription)
            .filter(PushSubscription.user_email.in_(emails))
            .all()
        )
        payload = {"title": title, "body": body, "url": url}
        for sub in subs:
            _executor.submit(_send_one, sub.endpoint, sub.p256dh, sub.auth, payload)
    finally:
        db.close()
