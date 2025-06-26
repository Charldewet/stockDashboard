import os
os.makedirs('db', exist_ok=True)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
from app.models import Base
from config.settings import DATABASE_URI # Import DATABASE_URI

# Create engine with better memory management
if DATABASE_URI.startswith('sqlite'):
    # For SQLite, use more conservative settings
    engine = create_engine(
        DATABASE_URI, 
        echo=False,
        poolclass=StaticPool,
        pool_pre_ping=True,
        connect_args={
            'check_same_thread': False,
            'timeout': 20
        }
    )
else:
    # For PostgreSQL and other databases
    engine = create_engine(
        DATABASE_URI,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=300,  # Recycle connections every 5 minutes
        pool_timeout=20,
        max_overflow=0,  # Don't allow overflow connections
        pool_size=2      # Keep pool small for memory efficiency
    )

# Use scoped session for thread safety and better cleanup
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

def create_session():
    """Create a new database session with automatic cleanup."""
    return SessionLocal()

def cleanup_db_sessions():
    """Clean up database sessions to free memory."""
    try:
        SessionLocal.remove()
        print("[DB] Database sessions cleaned up", flush=True)
    except Exception as e:
        print(f"[DB] Error cleaning up sessions: {e}", flush=True)

# Add this function for compatibility with scripts

def setup_db(database_uri=None):
    """Create all tables in the database specified by database_uri (or default)."""
    from app.models import Base
    if database_uri is None:
        database_uri = DATABASE_URI
    engine = create_engine(database_uri)
    Base.metadata.create_all(engine)

# The setup_db function is no longer needed as engine is initialized globally.
# def setup_db(db_uri):
#     engine = create_engine(db_uri)
#     Base.metadata.create_all(engine)
#     return engine 