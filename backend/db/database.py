import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base

load_dotenv(Path(__file__).parent.parent / ".env")

DB_HOST      = os.getenv("DB_HOST")
DB_PORT      = os.getenv("DB_PORT", "5432")
DB_NAME      = os.getenv("DB_NAME")
DB_USER      = os.getenv("DB_USER")
DB_PASSWORD  = os.getenv("DB_PASSWORD")
DB_AUTH_MODE = os.getenv("DB_AUTH_MODE", "password")

Base = declarative_base()




if DB_AUTH_MODE == "oauth":
    import psycopg
    from databricks.sdk import WorkspaceClient

    _ws = WorkspaceClient()  # reused across calls; handles token caching + refresh internally

    def _make_connection():
        token = _ws.config.oauth_token().access_token
        return psycopg.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            dbname=DB_NAME,
            user=DB_USER,
            password=token,
            sslmode="require",
        )

    engine = create_engine(
        "postgresql+psycopg://",
        creator=_make_connection,
        pool_pre_ping=True,
        pool_recycle=1800,  # recycle connections every 30 min, well before the 1-hour token expiry
    )

else:
    engine = create_engine(
        f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode=require",
        pool_pre_ping=True,
    )


# Connection test — runs once at startup
print("Connecting to database...")
try:
    with engine.connect() as conn:
        row = conn.execute(text("SELECT current_database(), current_user, version()")).fetchone()
    print("\n[OK] Connected successfully!\n")
    print(f"Database : {row[0]}")
    print(f"User     : {row[1]}")
    print(f"Version  : {row[2]}")
except Exception as e:
    print("\n[ERROR] Connection failed\n")
    print(e)
