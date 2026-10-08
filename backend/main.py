import asyncio
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.db.database import engine, Base
from backend.db import models  # noqa: F401
from backend.routers import tasks, occurrences, members, user, activity, notifications, kpi, subscriptions, projects, push, tracker, workload, settings, cost, liveops, liveops_reports, onboarding

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend import sse
    sse.set_loop(asyncio.get_event_loop())
    logger.info("Connecting to database and creating tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database ready.")
    yield


app = FastAPI(
    title="TeamPulse",
    lifespan=lifespan,
)

# -------------------------
# API Routers
# -------------------------

app.include_router(user.router)
app.include_router(tasks.router)
app.include_router(occurrences.router)
app.include_router(members.router)
app.include_router(activity.router)
app.include_router(notifications.router)
app.include_router(kpi.router)
app.include_router(subscriptions.router)
app.include_router(projects.router)
app.include_router(push.router)
app.include_router(tracker.router)
app.include_router(workload.router)
app.include_router(settings.router)
app.include_router(cost.router)
app.include_router(liveops.router)
app.include_router(liveops_reports.router)
app.include_router(onboarding.router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


# -------------------------
# Frontend
# -------------------------

static_dir = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "static",
)

assets_dir = os.path.join(static_dir, "assets")

# Serve Vite assets
if os.path.exists(assets_dir):
    app.mount(
        "/assets",
        StaticFiles(directory=assets_dir),
        name="assets",
    )


@app.get("/")
async def root():
    index_html = os.path.join(static_dir, "index.html")

    if os.path.exists(index_html):
        return FileResponse(index_html)

    raise HTTPException(
        status_code=404,
        detail="Frontend not built. Run 'npm run build' first.",
    )


@app.get("/sw.js")
async def service_worker():
    sw_path = os.path.join(static_dir, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(
            sw_path,
            media_type="application/javascript",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )
    raise HTTPException(status_code=404)


@app.get("/manifest.webmanifest")
async def web_manifest():
    manifest_path = os.path.join(static_dir, "manifest.webmanifest")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/manifest+json")
    raise HTTPException(status_code=404)


# Catch-all for React Router
# IMPORTANT: Keep this LAST.
@app.get("/{full_path:path}")
async def spa(full_path: str):
    # Never intercept API routes
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)

    # Serve existing static files (workbox chunks, icons, etc.) before SPA fallback
    requested_file = os.path.join(static_dir, full_path)
    if os.path.exists(requested_file) and os.path.isfile(requested_file):
        return FileResponse(requested_file)

    index_html = os.path.join(static_dir, "index.html")

    if os.path.exists(index_html):
        return FileResponse(index_html)

    raise HTTPException(
        status_code=404,
        detail="Frontend not built. Run 'npm run build' first.",
    )