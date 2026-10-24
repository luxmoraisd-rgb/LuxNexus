from functools import lru_cache
from AppCore.db import get_database


@lru_cache(maxsize=1)
def get_meetings_collection():
    db = get_database()
    return db["meetings"]
