# backend/app/database.py
# ==============================================================================
# Database Engine, Session Factory, and Declarative Base
# ==============================================================================
# This is the single source of truth for the SQLAlchemy setup.
# Every model imports `Base` from here.
# Every FastAPI route that needs DB access uses `get_db()` as a dependency.
#
# Key decisions (per ARCHITECTURE.md § 2.3 and PHASES.md § 1.3):
#   - SQLite via a local `restaurant.db` file.
#   - `check_same_thread=False` is required by SQLite when used with FastAPI's
#     async request handling (multiple threads may touch the same connection).
#   - `expire_on_commit=False` prevents lazy-load errors after commit in routes
#     that return ORM objects directly to Pydantic serializers.
# ==============================================================================

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Load .env values from the backend/ root before reading DATABASE_URL.
# point load_dotenv at the actual .env file so it works regardless of CWD.
_backend_dir = Path(__file__).resolve().parent.parent  # backend/app/../ == backend/
load_dotenv(dotenv_path=_backend_dir / ".env")

# ------------------------------------------------------------------------------
# Engine
# ------------------------------------------------------------------------------

# DATABASE_URL path fix:
# sqlite:///restaurant.db (3 slashes) is a RELATIVE path — SQLite resolves it
# against the CWD at the moment the engine is created. If uvicorn is launched
# from a different directory than the one where seed.py ran, SQLAlchemy silently
# opens (or creates) a different, empty database file. This is the classic
# "two database files" bug that causes GET /menu to return [].
#
# Fix: if DATABASE_URL is not set or uses the bare relative form, compute an
# absolute path anchored to this file's location (backend/app/database.py →
# backend/restaurant.db). An absolute path is unaffected by CWD.

_env_db_url: str = os.getenv("DATABASE_URL", "")

if not _env_db_url or _env_db_url == "sqlite:///restaurant.db":
    # Compute absolute path: backend/restaurant.db
    _db_path: Path = _backend_dir / "restaurant.db"
    DATABASE_URL: str = f"sqlite:///{_db_path.as_posix()}"
else:
    DATABASE_URL = _env_db_url

engine = create_engine(
    DATABASE_URL,
    # Required for SQLite in a multi-threaded WSGI/ASGI context.
    connect_args={"check_same_thread": False},
    # Flip to True temporarily to see every SQL statement in the server log.
    echo=False,
)

# Enable WAL mode for SQLite — improves concurrent read/write performance.
# This event fires once per new connection to the database.
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    # Enforce foreign key constraints at the SQLite level (disabled by default).
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ------------------------------------------------------------------------------
# Session Factory
# ------------------------------------------------------------------------------

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,   # Explicit commits only — we control transaction boundaries.
    autoflush=False,    # Flush manually before queries when needed.
    expire_on_commit=False,  # Keep attributes accessible after session.commit().
)


# ------------------------------------------------------------------------------
# Declarative Base
# ------------------------------------------------------------------------------
# All ORM model classes inherit from this Base.  SQLAlchemy uses it to track
# every model's metadata so create_all() knows which tables to build.

class Base(DeclarativeBase):
    pass


# ------------------------------------------------------------------------------
# FastAPI Dependency — get_db()
# ------------------------------------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """
    Yield a fresh SQLAlchemy Session for the duration of a single HTTP request.

    Usage in a FastAPI route:
        @router.get("/example")
        def example_route(db: Session = Depends(get_db)):
            ...

    The `finally` block guarantees the session is closed even if an exception
    is raised inside the route handler, preventing connection leaks.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
