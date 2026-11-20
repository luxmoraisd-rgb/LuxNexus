"""
Database utilities and helper functions for the HomePage API.
Provides database connectivity checks for the HomePage API.
"""
import time
import logging
from django.db import connection
from django.db.utils import OperationalError

logger = logging.getLogger(__name__)

def check_db_connection():
    """
    Verifies that the database is accessible and measures query latency.
    Returns a dictionary with status and latency in milliseconds.
    """
    start_time = time.time()
    try:
        connection.database.command("ping")
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "healthy",
            "connected": True,
            "engine": connection.vendor,
            "latency_ms": latency_ms,
        }
    except OperationalError as err:
        logger.error(f"Database operational error: {err}")
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(err),
            "latency_ms": None,
        }
    except Exception as exc:
        logger.error(f"Unexpected database error: {exc}")
        return {
            "status": "error",
            "connected": False,
            "error": str(exc),
            "latency_ms": None,
        }
