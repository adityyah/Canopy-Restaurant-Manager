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
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Load .env values from the backend/ root before reading DATABASE_URL.
load_dotenv()

# ------------------------------------------------------------------------------
# Engine
# ------------------------------------------------------------------------------

# The DATABASE_URL env var is expected in the form:
#   sqlite:///restaurant.db   (relative → file lives next to main.py)
# Falls back to a sane default so the dev server still starts without a .env.
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///restaurant.db")

engine = create_engine(
    DATABASE_URL,
    # Required for SQLite in a multi-threaded WSGI/ASGI context.
    connect_args={"check_same_thread": False},
    # Set echo=True here temporarily to log all SQL queries during debugging.
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
