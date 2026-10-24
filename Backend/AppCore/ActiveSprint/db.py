"""
Database utilities and helper methods for appcore.
Provides connection health checks, atomic transaction helpers,
and full MongoDB integration via PyMongo client with pooling.
"""
from django.db import connection, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import logging
import os
import time

logger = logging.getLogger(__name__)

# Global cached MongoClient instance
_mongo_client = None


# ==============================================================================
# RELATIONAL DATABASE HELPERS
# ==============================================================================

def check_db_connection() -> bool:
    """Check if the default database is reachable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
            return row is not None and row[0] == 1
    except Exception as exc:
        logger.error(f"Database connection error: {exc}")
        return False


def get_db_stats() -> dict:
    """Return runtime database statistics."""
    return {
        "vendor": connection.vendor,
        "is_usable": connection.is_usable(),
        "queries_count": len(connection.queries) if connection.queries else 0,
    }


def execute_raw_sql(sql: str, params: list = None) -> list:
    """Execute raw SQL query safely and return dictionary results."""
    params = params or []
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        if cursor.description is None:
            return []
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


class AtomicTransaction:
    """Context manager and decorator for atomic transactions with logging."""

    def __init__(self, savepoint=True):
        self.savepoint = savepoint
        self._atomic = None

    def __enter__(self):
        self._atomic = transaction.atomic(savepoint=self.savepoint)
        return self._atomic.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self._atomic.__exit__(exc_type, exc_val, exc_tb)


# ==============================================================================
# MONGODB DATABASE HELPERS
# ==============================================================================

def get_mongo_client(timeout_ms: int = 3000) -> MongoClient:
    """
    Get or create a singleton MongoClient instance with connection pooling.
    """
    global _mongo_client
    if _mongo_client is None:
        uri = getattr(settings, 'MONGODB_URI', os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        _mongo_client = MongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
            maxPoolSize=50,
            minPoolSize=5,
        )
    return _mongo_client


def get_mongo_db(db_name: str = None):
    """
    Return MongoDB Database instance.
    """
    client = get_mongo_client()
    target_name = db_name or getattr(settings, 'MONGODB_DATABASE', getattr(settings, 'MONGODB_DB_NAME', 'nexusapp'))
    return client[target_name]


def get_mongo_collection(collection_name: str, db_name: str = None):
    """
    Return a specific collection from the MongoDB database.
    """
    db = get_mongo_db(db_name)
    return db[collection_name]


def check_mongo_connection() -> dict:
    """
    Ping MongoDB and return detailed diagnostic status.
    """
    start_time = time.time()
    try:
        client = get_mongo_client()
        # Admin command ping
        client.admin.command('ping')
        latency_ms = round((time.time() - start_time) * 1000, 2)
        server_info = client.server_info()
        db = get_mongo_db()
        existing_collections = db.list_collection_names()

        return {
            "status": "connected",
            "ok": True,
            "version": server_info.get("version"),
            "host": getattr(settings, 'MONGODB_URI', 'mongodb://localhost:27017/'),
            "database": db.name,
            "latency_ms": latency_ms,
            "collections": existing_collections,
            "collections_count": len(existing_collections),
        }
    except (ConnectionFailure, ServerSelectionTimeoutError) as err:
        logger.error(f"MongoDB connection failed: {err}")
        return {
            "status": "disconnected",
            "ok": False,
            "error": str(err),
            "host": getattr(settings, 'MONGODB_URI', 'mongodb://localhost:27017/'),
        }
    except Exception as err:
        logger.error(f"Unexpected MongoDB error: {err}")
        return {
            "status": "error",
            "ok": False,
            "error": str(err),
            "host": getattr(settings, 'MONGODB_URI', 'mongodb://localhost:27017/'),
        }


def sync_django_models_to_mongo() -> dict:
    """
    Synchronize all Boards, Sprints, Columns, Views, and Tasks to MongoDB collections.
    Ensures MongoDB holds up-to-date document records for the Agile board.
    """
    from appcore.models import Board, Sprint, BoardColumn, BoardView, Task
    
    db = get_mongo_db()
    
    # 1. Sync Boards
    boards_col = db['boards']
    boards_data = [
        {"board_id": b.id, "name": b.name, "key": b.key, "description": b.description}
        for b in Board.objects.all()
    ]
    if boards_data:
        boards_col.delete_many({})
        boards_col.insert_many(boards_data)

    # 2. Sync Sprints
    sprints_col = db['sprints']
    sprints_data = [
        {
            "sprint_id": s.id,
            "board_id": s.board_id,
            "name": s.name,
            "status": s.status,
            "duration_text": s.duration_text,
            "goals": s.goals,
            "capacity_limit": s.capacity_limit,
            "total_sp": s.total_sp,
            "issues_count": s.issues_count,
        }
        for s in Sprint.objects.all()
    ]
    if sprints_data:
        sprints_col.delete_many({})
        sprints_col.insert_many(sprints_data)

    # 3. Sync Tasks
    tasks_col = db['tasks']
    tasks_data = [
        {
            "task_id": t.id,
            "task_key": t.task_key,
            "title": t.title,
            "board_id": t.board_id,
            "sprint_id": t.sprint_id,
            "owner": t.owner.username if t.owner else None,
            "status": t.status,
            "task_type": t.task_type,
            "estimated_sp": t.estimated_sp,
            "epic": t.epic,
            "comments_count": t.comments_count,
        }
        for t in Task.objects.all()
    ]
    if tasks_data:
        tasks_col.delete_many({})
        tasks_col.insert_many(tasks_data)

    # 4. Sync Columns
    cols_col = db['columns']
    cols_data = [
        {
            "column_id": c.id,
            "board_id": c.board_id,
            "name": c.name,
            "column_type": c.column_type,
            "order": c.order,
            "settings": c.settings,
            "extensions": c.extensions,
        }
        for c in BoardColumn.objects.all()
    ]
    if cols_data:
        cols_col.delete_many({})
        cols_col.insert_many(cols_data)

    # 5. Sync Views
    views_col = db['views']
    views_data = [
        {
            "view_id": v.id,
            "board_id": v.board_id,
            "name": v.name,
            "view_type": v.view_type,
            "filters": v.filters,
            "sorting": v.sorting,
            "grouping": v.grouping,
            "options": v.options,
        }
        for v in BoardView.objects.all()
    ]
    if views_data:
        views_col.delete_many({})
        views_col.insert_many(views_data)

    return {
        "status": "synced",
        "boards_synced": len(boards_data),
        "sprints_synced": len(sprints_data),
        "tasks_synced": len(tasks_data),
        "columns_synced": len(cols_data),
        "views_synced": len(views_data),
    }
