from datetime import datetime, timezone


def _text(value):
    return str(value or "").strip()


def _status_for_task(status):
    normalized = _text(status).lower()
    if normalized == "done":
        return "achieved", 100
    if normalized == "in review":
        return "on track", 75
    if normalized == "in progress":
        return "on track", 50
    return "on track", 0


def _owner_identity(owner):
    if isinstance(owner, dict):
        value = owner.get("email") or owner.get("name") or owner.get("username") or owner.get("id")
    else:
        value = owner
    return _text(value)


def _owner_label(owner):
    if isinstance(owner, dict):
        return _text(owner.get("name") or owner.get("email") or owner.get("username") or owner.get("id"))
    return _text(owner)


def _normal_owner(owner):
    label = _owner_label(owner)
    if not label:
        return None
    return {
        "name": label,
        "initials": label[:2].upper(),
        "email": _text(owner.get("email")) if isinstance(owner, dict) else "",
    }


def _resolve_project_members(db, project):
    identities = []
    members = project.get("members") or []
    if not isinstance(members, list):
        members = [members]
    members.extend([
        project.get("lead"),
        project.get("project_lead"),
        project.get("created_by"),
    ])

    for member in members:
        if not member:
            continue
        if isinstance(member, dict):
            identities.append(_normal_owner(member))
            continue
        member_text = _text(member)
        if not member_text:
            continue
        user = None
        try:
            from bson import ObjectId
            if ObjectId.is_valid(member_text):
                user = db.users.find_one({"_id": ObjectId(member_text)})
        except Exception:
            user = None
        if not user:
            user = db.users.find_one({
                "$or": [
                    {"email": member_text},
                    {"username": member_text},
                    {"name": member_text},
                ]
            })
        if user:
            name = _text(user.get("name") or user.get("username") or user.get("email"))
            identities.append({
                "name": name,
                "initials": name[:2].upper(),
                "email": _text(user.get("email")),
                "id": str(user.get("_id", "")),
            })
        else:
            identities.append({
                "name": member_text,
                "initials": member_text[:2].upper(),
                "email": member_text if "@" in member_text else "",
            })

    unique = {}
    for owner in identities:
        if owner:
            key = (_owner_identity(owner) or _owner_label(owner)).lower()
            if key:
                unique[key] = owner
    return list(unique.values())


def sync_goals_from_projects(db):
    """Create and refresh automatic project, sprint, and task goals."""
    goals = db["goals"]
    projects = list(db["projects"].find({}))
    sprints = list(db["sprints"].find({}))
    tasks = list(db["tasks"].find({}))
    now = datetime.now(timezone.utc)
    live_auto_ids = set()

    for project in projects:
        project_id = _text(project.get("_id") or project.get("id") or project.get("key"))
        project_name = _text(project.get("name") or "Project")
        members = _resolve_project_members(db, project)

        for owner in members:
            source_key = f"project:{project_id}:{_owner_identity(owner).lower()}"
            live_auto_ids.add(source_key)
            document = {
                "name": f"Finish project: {project_name}",
                "status": "on track" if _text(project.get("status")).lower() not in {"completed", "archived"} else "achieved",
                "progress": 100 if _text(project.get("status")).lower() in {"completed", "archived"} else 0,
                "team": project_name,
                "accountable_team": project_name,
                "time_period": "",
                "timePeriod": "",
                "owner": owner,
                "due_date": _text(project.get("end_date") or project.get("endDate")),
                "dueDate": _text(project.get("end_date") or project.get("endDate")),
                "status_summary": f"Project target for {project_name}",
                "statusSummary": f"Project target for {project_name}",
                "auto_goal": True,
                "source_type": "project",
                "source_id": project_id,
                "source_key": source_key,
                "updated_at": now,
            }
            goals.update_one({"source_key": source_key}, {"$set": document, "$setOnInsert": {"created_at": now}}, upsert=True)

        project_sprints = [
            sprint for sprint in sprints
            if _text(sprint.get("project_id")) == project_id
            or _text(sprint.get("projectId")) == project_id
        ]
        for sprint in project_sprints:
            sprint_id = _text(sprint.get("_id") or sprint.get("sprint_id") or sprint.get("id"))
            sprint_name = _text(sprint.get("name") or f"Sprint {sprint_id}")
            due_date = _text(sprint.get("end_date") or sprint.get("endDate"))
            sprint_status = _text(sprint.get("status")).lower()

            for owner in members:
                source_key = f"sprint:{sprint_id}:{_owner_identity(owner).lower()}"
                live_auto_ids.add(source_key)
                document = {
                    "name": f"Finish {project_name} / {sprint_name}",
                    "status": "achieved" if sprint_status == "completed" else "on track",
                    "progress": 100 if sprint_status == "completed" else (50 if sprint_status == "active" else 0),
                    "team": project_name,
                    "accountable_team": project_name,
                    "time_period": sprint_name,
                    "timePeriod": sprint_name,
                    "owner": owner,
                    "due_date": due_date,
                    "dueDate": due_date,
                    "status_summary": f"Sprint target for {sprint_name}",
                    "statusSummary": f"Sprint target for {sprint_name}",
                    "auto_goal": True,
                    "source_type": "sprint",
                    "source_id": sprint_id,
                    "source_key": source_key,
                    "updated_at": now,
                }
                goals.update_one({"source_key": source_key}, {"$set": document, "$setOnInsert": {"created_at": now}}, upsert=True)

            sprint_tasks = [
                task for task in tasks
                if _text(task.get("sprint_id") or task.get("sprintId")) == sprint_id
                or _text(task.get("sprint_id") or task.get("sprintId")) == str(sprint.get("id") or "")
            ]
            for task in sprint_tasks:
                task_owner = task.get("owner")
                if not isinstance(task_owner, dict):
                    task_owner = _resolve_task_owner(db, task_owner)
                owner = _normal_owner(task_owner)
                if not owner:
                    continue
                task_id = _text(task.get("_id") or task.get("task_id") or task.get("id"))
                task_title = _text(task.get("title") or task.get("task") or "Task")
                task_status, progress = _status_for_task(task.get("status"))
                due_date = _text(task.get("due_date") or task.get("dueDate") or sprint.get("end_date") or sprint.get("endDate"))
                source_key = f"task:{task_id}:{_owner_identity(owner).lower()}"
                live_auto_ids.add(source_key)
                document = {
                    "name": f"Finish task: {task_title}",
                    "status": task_status,
                    "progress": progress,
                    "team": project_name,
                    "accountable_team": project_name,
                    "time_period": sprint_name,
                    "timePeriod": sprint_name,
                    "owner": owner,
                    "due_date": due_date,
                    "dueDate": due_date,
                    "status_summary": f"{task_title} in {project_name} / {sprint_name}",
                    "statusSummary": f"{task_title} in {project_name} / {sprint_name}",
                    "auto_goal": True,
                    "source_type": "task",
                    "source_id": task_id,
                    "source_key": source_key,
                    "updated_at": now,
                }
                goals.update_one({"source_key": source_key}, {"$set": document, "$setOnInsert": {"created_at": now}}, upsert=True)

    stale = [
        goal["_id"] for goal in goals.find({"auto_goal": True})
        if _text(goal.get("source_key")) not in live_auto_ids
    ]
    if stale:
        goals.delete_many({"_id": {"$in": stale}})


def _resolve_task_owner(db, owner_value):
    owner_text = _text(owner_value)
    if not owner_text:
        return None
    user = db.users.find_one({
        "$or": [
            {"email": owner_text},
            {"username": owner_text},
            {"name": owner_text},
        ]
    })
    if not user:
        return {"name": owner_text, "email": owner_text if "@" in owner_text else ""}
    return {
        "name": _text(user.get("name") or user.get("username") or user.get("email")),
        "email": _text(user.get("email")),
        "username": _text(user.get("username")),
        "id": str(user.get("_id", "")),
    }
