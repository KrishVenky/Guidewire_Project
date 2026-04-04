from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config import get_settings
from database import create_tables, SessionLocal

settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[Startup] Creating database tables...")
    create_tables()

    logger.info("[Startup] Seeding zones...")
    db = SessionLocal()
    try:
        from seeds.zones import seed_zones
        seed_zones(db)
    finally:
        db.close()

    logger.info("[Startup] Training ML models...")
    try:
        from ml.train_premium_model import train_and_save as train_premium
        from ml.fraud_model import train_and_save as train_fraud
        train_premium()
        train_fraud()
    except Exception as e:
        logger.warning(f"[Startup] ML training skipped: {e}")

    logger.info("[Startup] Seeding demo users...")
    try:
        from seeds.demo_users import run as seed_demo_users
        seed_demo_users()
    except Exception as e:
        logger.warning(f"[Startup] Demo user seeding skipped: {e}")

    logger.info("[Startup] Starting APScheduler...")
    from jobs.scheduler import start_scheduler
    start_scheduler()

    yield

    logger.info("[Shutdown] Stopping scheduler...")
    from jobs.scheduler import scheduler
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="RainReady API",
    description="Dual-trigger parametric income insurance for delivery workers",
    version="2.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import workers, policies, claims, disruptions, admin, llm

app.include_router(workers.router)
app.include_router(policies.router)
app.include_router(claims.router)
app.include_router(disruptions.router)
app.include_router(admin.router)
app.include_router(llm.router)


@app.get("/health")
def health_check():
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        db_status = "connected"
    except Exception:
        db_status = "error"

    return {"status": "ok", "db": db_status, "version": "2.0.0"}
