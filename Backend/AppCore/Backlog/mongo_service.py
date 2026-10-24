"""
MongoDB Data Service for Backlog (Tasks, Sprints, Boards, Columns, Views, Users).
Ensures 100% of Backlog operations read and persist directly in MongoDB (mongodb://localhost:27017/).
"""
from datetime import datetime, timezone
import re
from bson import ObjectId
from .db import get_mongo_db


def serialize_task(t):
    """Normalize MongoDB task document to frontend format."""
    if not t or not isinstance(t, dict):
        return None
    task_id = t.get("task_id") or t.get("id") or 1
    task_key = t.get("task_key") or t.get("taskId") or f"LUX-{task_id:03d}"
    title = t.get("title") or t.get("task") or "Untitled task"
    status_val = t.get("status") or "Ready to start"
    type_val = t.get("task_type") or t.get("type") or "Frontend"
    sp_val = t.get("estimated_sp") if t.get("estimated_sp") is not None else (t.get("sp") or 3)
    try:
        sp_val = int(sp_val)
    except (ValueError, TypeError):
        sp_val = 3

    sprint_id = t.get("sprint_id")
    if sprint_id is None:
        sprint_id = t.get("sprintId")
    if sprint_id in ("backlog", None, ""):
        resolved_sprint_id = None
        sprint_id_str = "backlog"
    else:
        try:
            resolved_sprint_id = int(sprint_id)
            sprint_id_str = resolved_sprint_id
        except (ValueError, TypeError):
            resolved_sprint_id = None
            sprint_id_str = "backlog"

    due_date = str(t.get("due_date") or t.get("dueDate") or "")
    start_date = str(t.get("start_date") or t.get("startDate") or "")
    # Jira & Monday.com style: Incomplete tasks with past due dates automatically belong to the Backlog
    if due_date and str(status_val).strip().lower() != "done":
        try:
            clean_str = due_date[:10]
            d = datetime.strptime(clean_str, "%Y-%m-%d").date()
            if d < datetime.now(timezone.utc).date():
                resolved_sprint_id = None
                sprint_id_str = "backlog"
        except Exception:
            pass

    created_at = t.get("created_at")
    updated_at = t.get("updated_at")

    return {
        "id": task_id,
        "task_id": task_id,
        "taskId": task_key,
        "task_key": task_key,
        "title": title,
        "task": title,
        "description": t.get("description", ""),
        "status": status_val,
        "type": type_val,
        "task_type": type_val,
        "sp": sp_val,
        "estimated_sp": sp_val,
        "epic": t.get("epic", ""),
        "start_date": start_date,
        "startDate": start_date,
        "due_date": due_date,
        "dueDate": due_date,
        "sprint_id": resolved_sprint_id,
        "sprintId": sprint_id_str,
        "board_id": t.get("board_id", 1),
        "owner": t.get("owner"),
        "comments": t.get("comments", []),
        "comments_count": len(t.get("comments", [])) if "comments" in t else t.get("comments_count", 0),
        "order": t.get("order", 0),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or ""),
        "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at or ""),
    }


def serialize_sprint(s, db=None):
    """Normalize MongoDB sprint document to frontend format."""
    if not s or not isinstance(s, dict):
        return None
    sprint_id = s.get("sprint_id") or s.get("id") or 1
    name = s.get("name") or f"Sprint {sprint_id}"
    status_val = s.get("status") or "future"
    duration_text = s.get("duration_text") or s.get("dates") or ""
    try:
        capacity_limit = int(s.get("capacity_limit") or 20)
    except (ValueError, TypeError):
        capacity_limit = 20

    total_sp = s.get("total_sp")
    issues_count = s.get("issues_count")
    if db is not None:
        tasks_in_sprint = list(db.tasks.find({"sprint_id": sprint_id}))
        total_sp = sum(int(t.get("estimated_sp") or t.get("sp") or 0) for t in tasks_in_sprint)
        issues_count = len(tasks_in_sprint)

    created_at = s.get("created_at")
    updated_at = s.get("updated_at")

    return {
        "id": sprint_id,
        "sprint_id": sprint_id,
        "board_id": s.get("board_id", 1),
        "name": name,
        "status": status_val,
        "dates": duration_text,
        "duration_text": duration_text,
        "start_date": str(s.get("start_date", "")),
        "end_date": str(s.get("end_date", "")),
        "goals": s.get("goals", ""),
        "capacity_limit": capacity_limit,
        "total_sp": total_sp if total_sp is not None else 0,
        "issues_count": issues_count if issues_count is not None else 0,
        "isStarted": status_val == "active",
        "isCompleted": status_val == "completed",
        "order": s.get("order", 0),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or ""),
        "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at or ""),
    }





def get_or_create_board(board_id=1, key="LUX"):
    db = get_mongo_db()
    board = db.boards.find_one({"board_id": board_id})
    if not board:
        board = db.boards.find_one()
    if not board:
        now = datetime.now(timezone.utc)
        board = {
            "board_id": board_id,
            "name": "Tasks",
            "key": key,
            "description": "Tasks Board",
            "created_at": now,
            "updated_at": now,
        }
        db.boards.insert_one(board)
    return board


def get_project_key():
    board = get_or_create_board()
    return board.get("key", "LUX")


def set_project_key(new_key):
    db = get_mongo_db()
    clean_key = (new_key or "LUX").strip().upper()
    now = datetime.now(timezone.utc)
    db.boards.update_one(
        {"board_id": 1},
        {"$set": {"key": clean_key, "updated_at": now}},
        upsert=True,
    )
    return clean_key




def list_tasks(filters=None):
    """List tasks directly from MongoDB collection."""
    db = get_mongo_db()
    query = {}
    if filters:
        if filters.get("sprint_id") is not None:
            sid = filters.get("sprint_id")
            if sid in ("backlog", "null", None):
                query["sprint_id"] = None
            else:
                try:
                    query["sprint_id"] = int(sid)
                except ValueError:
                    query["sprint_id"] = sid
        if filters.get("status"):
            query["status"] = filters.get("status")
        if filters.get("type"):
            query["$or"] = [
                {"task_type": filters.get("type")},
                {"type": filters.get("type")},
            ]
        if filters.get("q"):
            q_str = re.escape(str(filters.get("q")).strip())
            regex = {"$regex": q_str, "$options": "i"}
            query["$or"] = [
                {"title": regex},
                {"task_key": regex},
                {"description": regex},
                {"epic": regex},
            ]

    cursor = db.tasks.find(query).sort("order", 1)
    return [serialize_task(t) for t in cursor]


def get_task_by_id(task_identifier):
    """Retrieve single task document by task_id integer, task_key string, or _id."""
    db = get_mongo_db()
    query = None
    try:
        tid_int = int(task_identifier)
        query = {"$or": [{"task_id": tid_int}, {"id": tid_int}]}
    except (ValueError, TypeError):
        if ObjectId.is_valid(str(task_identifier)):
            query = {"_id": ObjectId(str(task_identifier))}
        else:
            query = {"task_key": str(task_identifier)}

    doc = db.tasks.find_one(query)
    return serialize_task(doc) if doc else None


def create_task(data):
    """Insert new task into MongoDB collection."""
    db = get_mongo_db()
    now = datetime.now(timezone.utc)

    # Determine next task_id
    highest_task = db.tasks.find_one(sort=[("task_id", -1)])
    next_id = 1
    if highest_task and highest_task.get("task_id"):
        next_id = highest_task.get("task_id") + 1

    board_key = get_project_key()
    task_key = data.get("task_key") or data.get("taskId") or f"{board_key}-{next_id:03d}"
    title = (data.get("title") or data.get("task") or "New Task").strip()
    status_val = data.get("status") or "Ready to start"
    type_val = data.get("type") or data.get("task_type") or "Frontend"

    try:
        sp_val = int(data.get("sp") or data.get("estimated_sp") or 3)
    except (ValueError, TypeError):
        sp_val = 3

    sprint_id = data.get("sprint_id")
    if sprint_id is None:
        sprint_id = data.get("sprintId")
    if sprint_id in ("backlog", None, ""):
        resolved_sprint_id = None
    else:
        try:
            resolved_sprint_id = int(sprint_id)
        except (ValueError, TypeError):
            resolved_sprint_id = None

    start_date = str(data.get("startDate") or data.get("start_date") or "").strip()
    due_date = str(data.get("dueDate") or data.get("due_date") or "").strip()
    if due_date and str(status_val).strip().lower() != "done":
        try:
            clean_str = due_date[:10]
            d = datetime.strptime(clean_str, "%Y-%m-%d").date()
            if d < datetime.now(timezone.utc).date():
                resolved_sprint_id = None
        except Exception:
            pass

    doc = {
        "task_id": next_id,
        "id": next_id,
        "task_key": task_key,
        "title": title,
        "description": data.get("description", ""),
        "board_id": int(data.get("board_id") or 1),
        "sprint_id": resolved_sprint_id,
        "owner": data.get("owner"),
        "status": status_val,
        "task_type": type_val,
        "type": type_val,
        "estimated_sp": sp_val,
        "sp": sp_val,
        "epic": data.get("epic", ""),
        "start_date": start_date,
        "startDate": start_date,
        "due_date": due_date,
        "dueDate": due_date,
        "comments": data.get("comments", []),
        "comments_count": 0,
        "order": next_id,
        "created_at": now,
        "updated_at": now,
    }

    db.tasks.insert_one(doc)
    return serialize_task(doc)


def update_task(task_identifier, updates):
    """Update task document in MongoDB collection."""
    db = get_mongo_db()
    query = None
    try:
        tid_int = int(task_identifier)
        query = {"$or": [{"task_id": tid_int}, {"id": tid_int}]}
    except (ValueError, TypeError):
        if ObjectId.is_valid(str(task_identifier)):
            query = {"_id": ObjectId(str(task_identifier))}
        else:
            query = {"task_key": str(task_identifier)}

    set_fields = {"updated_at": datetime.now(timezone.utc)}

    if "title" in updates or "task" in updates:
        val = updates.get("title") or updates.get("task")
        set_fields["title"] = val
    if "description" in updates:
        set_fields["description"] = updates["description"]
    if "status" in updates:
        set_fields["status"] = updates["status"]
    if "type" in updates or "task_type" in updates:
        val = updates.get("type") or updates.get("task_type")
        set_fields["type"] = val
        set_fields["task_type"] = val
    if "sp" in updates or "estimated_sp" in updates:
        raw_sp = updates.get("sp") if "sp" in updates else updates.get("estimated_sp")
        try:
            set_fields["sp"] = int(raw_sp)
            set_fields["estimated_sp"] = int(raw_sp)
        except (ValueError, TypeError):
            pass
    if "epic" in updates:
        set_fields["epic"] = updates["epic"]
    if "owner" in updates:
        set_fields["owner"] = updates["owner"]
    if "start_date" in updates or "startDate" in updates:
        s_val = str(updates.get("start_date") or updates.get("startDate") or "").strip()
        set_fields["start_date"] = s_val
        set_fields["startDate"] = s_val
    if "due_date" in updates or "dueDate" in updates:
        d_val = str(updates.get("due_date") or updates.get("dueDate") or "").strip()
        set_fields["due_date"] = d_val
        set_fields["dueDate"] = d_val
        st = updates.get("status") or ""
        if not st:
            cur = db.tasks.find_one(query)
            st = cur.get("status") if cur else "Ready to start"
        if d_val and str(st).strip().lower() != "done":
            try:
                clean_str = d_val[:10]
                d = datetime.strptime(clean_str, "%Y-%m-%d").date()
                if d < datetime.now(timezone.utc).date():
                    set_fields["sprint_id"] = None
            except Exception:
                pass
    if "sprint_id" in updates or "sprintId" in updates:
        sid = updates.get("sprint_id") if "sprint_id" in updates else updates.get("sprintId")
        if sid in ("backlog", None, ""):
            set_fields["sprint_id"] = None
        else:
            try:
                set_fields["sprint_id"] = int(sid)
            except (ValueError, TypeError):
                set_fields["sprint_id"] = None
    if "comments" in updates and isinstance(updates["comments"], list):
        set_fields["comments"] = updates["comments"]
        set_fields["comments_count"] = len(updates["comments"])

    db.tasks.update_one(query, {"$set": set_fields})
    doc = db.tasks.find_one(query)
    return serialize_task(doc) if doc else None


def delete_task(task_identifier):
    """Delete task document from MongoDB collection."""
    db = get_mongo_db()
    query = None
    try:
        tid_int = int(task_identifier)
        query = {"$or": [{"task_id": tid_int}, {"id": tid_int}]}
    except (ValueError, TypeError):
        if ObjectId.is_valid(str(task_identifier)):
            query = {"_id": ObjectId(str(task_identifier))}
        else:
            query = {"task_key": str(task_identifier)}
    res = db.tasks.delete_one(query)
    return res.deleted_count > 0




def list_sprints(board_id=None):
    """List sprints directly from MongoDB collection."""
    db = get_mongo_db()
    query = {}
    if board_id:
        try:
            query["board_id"] = int(board_id)
        except (ValueError, TypeError):
            pass
    cursor = db.sprints.find(query).sort("order", 1)
    sprints = list(cursor)
    if not sprints:
        # Provide default Sprint 1 if none exists
        default_sprint = create_sprint({"name": "Sprint 1", "capacity_limit": 20})
        return [default_sprint]
    return [serialize_sprint(s, db=db) for s in sprints]


def get_sprint_by_id(sprint_id):
    db = get_mongo_db()
    try:
        sid_int = int(sprint_id)
        query = {"$or": [{"sprint_id": sid_int}, {"id": sid_int}]}
    except (ValueError, TypeError):
        query = {"name": str(sprint_id)}
    doc = db.sprints.find_one(query)
    return serialize_sprint(doc, db=db) if doc else None


def get_last_created_sprint():
    db = get_mongo_db()
    doc = db.sprints.find_one(sort=[("sprint_id", -1)])
    return serialize_sprint(doc, db=db) if doc else None


def create_sprint(data):
    """Create new sprint in MongoDB collection."""
    db = get_mongo_db()
    now = datetime.now(timezone.utc)

    highest_sprint = db.sprints.find_one(sort=[("sprint_id", -1)])
    next_id = 1
    if highest_sprint and highest_sprint.get("sprint_id"):
        next_id = highest_sprint.get("sprint_id") + 1

    name = (data.get("name") or f"Sprint {next_id}").strip()
    status_val = data.get("status") or "future"
    duration_text = data.get("duration_text") or data.get("dates") or ""
    try:
        capacity_limit = int(data.get("capacity_limit") or 20)
    except (ValueError, TypeError):
        capacity_limit = 20

    doc = {
        "sprint_id": next_id,
        "id": next_id,
        "board_id": int(data.get("board_id") or 1),
        "name": name,
        "status": status_val,
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "duration_text": duration_text,
        "goals": data.get("goals", ""),
        "capacity_limit": capacity_limit,
        "order": next_id,
        "total_sp": 0,
        "issues_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    db.sprints.insert_one(doc)
    return serialize_sprint(doc, db=db)


def update_sprint(sprint_id, updates):
    db = get_mongo_db()
    try:
        sid_int = int(sprint_id)
        query = {"$or": [{"sprint_id": sid_int}, {"id": sid_int}]}
    except (ValueError, TypeError):
        query = {"name": str(sprint_id)}

    set_fields = {"updated_at": datetime.now(timezone.utc)}
    if "name" in updates:
        set_fields["name"] = updates["name"]
    if "status" in updates:
        set_fields["status"] = updates["status"]
    if "duration_text" in updates or "dates" in updates:
        val = updates.get("duration_text") or updates.get("dates")
        set_fields["duration_text"] = val
    if "goals" in updates:
        set_fields["goals"] = updates["goals"]
    if "capacity_limit" in updates:
        try:
            set_fields["capacity_limit"] = int(updates["capacity_limit"])
        except (ValueError, TypeError):
            pass

    db.sprints.update_one(query, {"$set": set_fields})
    doc = db.sprints.find_one(query)
    return serialize_sprint(doc, db=db) if doc else None


def start_sprint(sprint_id):
    return update_sprint(sprint_id, {"status": "active"})




def list_users():
    """Fetch users from MongoDB users collection."""
    db = get_mongo_db()
    users_cursor = db.users.find({}, {"password_hash": 0}).sort("username", 1)
    users = []
    for u in users_cursor:
        uid = str(u.get("_id"))
        uname = u.get("username", "")
        name = u.get("first_name") or uname
        email = u.get("email", "")
        profile = u.get("profile") or {}
        avatar = profile.get("avatar") or ""
        users.append({
            "id": uid,
            "username": uname,
            "name": name,
            "fullName": name,
            "email": email,
            "avatar": avatar,
        })
    return users




def list_columns(board_id=1):
    db = get_mongo_db()
    cols = list(db.columns.find({"board_id": board_id}).sort("order", 1))
    if not cols:
        # Default board columns matching Jira
        default_cols = [
            {"column_id": 1, "board_id": board_id, "name": "Task", "column_type": "text", "order": 1, "is_hidden": False, "settings": {}, "extensions": {}},
            {"column_id": 2, "board_id": board_id, "name": "Owner", "column_type": "user", "order": 2, "is_hidden": False, "settings": {}, "extensions": {}},
            {"column_id": 3, "board_id": board_id, "name": "Status", "column_type": "status", "order": 3, "is_hidden": False, "settings": {}, "extensions": {}},
            {"column_id": 4, "board_id": board_id, "name": "Type", "column_type": "dropdown", "order": 4, "is_hidden": False, "settings": {}, "extensions": {}},
            {"column_id": 5, "board_id": board_id, "name": "SP", "column_type": "number", "order": 5, "is_hidden": False, "settings": {}, "extensions": {}},
        ]
        db.columns.insert_many(default_cols)
        cols = default_cols
    for c in cols:
        c["id"] = c.get("column_id") or c.get("id")
    return cols


def create_column(data):
    db = get_mongo_db()
    now = datetime.now(timezone.utc)
    highest = db.columns.find_one(sort=[("column_id", -1)])
    next_id = 1
    if highest and highest.get("column_id"):
        next_id = highest.get("column_id") + 1

    doc = {
        "column_id": next_id,
        "id": next_id,
        "board_id": int(data.get("board_id") or 1),
        "name": data.get("name", "New Column"),
        "column_type": data.get("column_type", "text"),
        "order": next_id,
        "is_hidden": False,
        "settings": data.get("settings", {}),
        "extensions": data.get("extensions", {}),
        "created_at": now,
        "updated_at": now,
    }
    db.columns.insert_one(doc)
    return doc


def update_column(col_id, updates):
    db = get_mongo_db()
    try:
        cid = int(col_id)
        query = {"column_id": cid}
    except (ValueError, TypeError):
        query = {"name": str(col_id)}

    db.columns.update_one(query, {"$set": {**updates, "updated_at": datetime.now(timezone.utc)}})
    doc = db.columns.find_one(query)
    if doc:
        doc["id"] = doc.get("column_id")
    return doc


def list_views(board_id=1):
    db = get_mongo_db()
    views = list(db.views.find({"board_id": board_id}).sort("id", 1))
    if not views:
        default_views = [
            {"view_id": 1, "id": 1, "board_id": board_id, "name": "Backlog", "view_type": "backlog", "is_custom": False, "filters": {}, "sorting": [], "grouping": {}, "hidden_columns": [], "options": {}},
            {"view_id": 2, "id": 2, "board_id": board_id, "name": "Kanban", "view_type": "kanban", "is_custom": False, "filters": {}, "sorting": [], "grouping": {}, "hidden_columns": [], "options": {}},
            {"view_id": 3, "id": 3, "board_id": board_id, "name": "Active Sprint", "view_type": "active_sprint", "is_custom": False, "filters": {}, "sorting": [], "grouping": {}, "hidden_columns": [], "options": {}},
            {"view_id": 4, "id": 4, "board_id": board_id, "name": "All Sprints", "view_type": "all_sprints", "is_custom": False, "filters": {}, "sorting": [], "grouping": {}, "hidden_columns": [], "options": {}},
        ]
        db.views.insert_many(default_views)
        views = default_views
    for v in views:
        v["id"] = v.get("view_id") or v.get("id")
    return views


def update_view(view_id, updates):
    db = get_mongo_db()
    try:
        vid = int(view_id)
        query = {"$or": [{"view_id": vid}, {"id": vid}]}
    except (ValueError, TypeError):
        query = {"name": str(view_id)}

    db.views.update_one(query, {"$set": {**updates, "updated_at": datetime.now(timezone.utc)}})
    doc = db.views.find_one(query)
    if doc:
        doc["id"] = doc.get("view_id") or doc.get("id")
    return doc
