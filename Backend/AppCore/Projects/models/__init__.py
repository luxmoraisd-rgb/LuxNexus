from datetime import datetime, timezone
from bson import ObjectId
from ..db import get_projects_collection

INITIAL_PROJECT_SEEDS = [
    {
        "name": "Nexus Core Platform v2",
        "key": "NEX-CORE",
        "category": "Engineering",
        "description": "Architectural overhaul and feature upgrades for enterprise multi-tenancy and real-time collaboration.",
        "color": "#6366f1",
        "is_default_workspace": True,
        "isDefaultWorkspace": True,
        "progress": 72,
        "active_sprint_name": "Sprint 4 - Core Sync",
        "activeSprintName": "Sprint 4 - Core Sync",
        "start_date": "2026-01-10",
        "startDate": "2026-01-10",
    },
    {
        "name": "Mobile App Redesign",
        "key": "NEX-MOB",
        "category": "Design",
        "description": "Next-generation iOS and Android workspace experience featuring dark mode and offline task caching.",
        "color": "#06b6d4",
        "is_default_workspace": False,
        "isDefaultWorkspace": False,
        "progress": 48,
        "active_sprint_name": "Sprint 2 - Touch UI",
        "activeSprintName": "Sprint 2 - Touch UI",
        "start_date": "2026-02-01",
        "startDate": "2026-02-01",
    },
    {
        "name": "AI Copilot & Workflow Automation",
        "key": "NEX-AI",
        "category": "Engineering",
        "description": "Intelligent issue auto-tagging, backlog grooming suggestions, and natural language query parser.",
        "color": "#8b5cf6",
        "is_default_workspace": False,
        "isDefaultWorkspace": False,
        "progress": 85,
        "active_sprint_name": "Sprint 5 - Prompt Eng",
        "activeSprintName": "Sprint 5 - Prompt Eng",
        "start_date": "2026-02-15",
        "startDate": "2026-02-15",
    },
    {
        "name": "Growth & Customer Onboarding",
        "key": "NEX-GRW",
        "category": "Marketing",
        "description": "Self-service workspace tour, interactive team templates, and enterprise invitation funnel optimization.",
        "color": "#10b981",
        "is_default_workspace": False,
        "isDefaultWorkspace": False,
        "progress": 60,
        "active_sprint_name": "Sprint 3 - Funnel Revamp",
        "activeSprintName": "Sprint 3 - Funnel Revamp",
        "start_date": "2026-03-01",
        "startDate": "2026-03-01",
    },
    {
        "name": "DevOps & Global Infrastructure",
        "key": "NEX-OPS",
        "category": "Operations",
        "description": "Multi-region Kubernetes deployment, automated zero-downtime rollouts, and SOC2 compliance monitoring.",
        "color": "#f59e0b",
        "is_default_workspace": False,
        "isDefaultWorkspace": False,
        "progress": 35,
        "active_sprint_name": "Sprint 1 - Cloud Cluster",
        "activeSprintName": "Sprint 1 - Cloud Cluster",
        "start_date": "2026-03-10",
        "startDate": "2026-03-10",
    },
]


def ensure_seed_projects():
    """Ensure default projects exist in MongoDB collection."""
    try:
        col = get_projects_collection()
        if col.count_documents({}) == 0:
            now = datetime.now(timezone.utc).isoformat()
            seeds = []
            for item in INITIAL_PROJECT_SEEDS:
                doc = dict(item)
                doc["created_at"] = now
                doc["updated_at"] = now
                doc["created_by"] = "system"
                seeds.append(doc)
            col.insert_many(seeds)
    except Exception as e:
        print(f"Warning: Could not seed initial projects: {e}")


def serialize_project(doc):
    """Normalize MongoDB document for API responses."""
    if not doc:
        return None
    data = dict(doc)
    doc_id = str(data.pop("_id", data.get("id", "")))
    data["id"] = doc_id

    # Normalize camelCase and snake_case compatibility
    is_default = bool(data.get("is_default_workspace", data.get("isDefaultWorkspace", False)))
    data["is_default_workspace"] = is_default
    data["isDefaultWorkspace"] = is_default

    active_sprint = data.get("active_sprint_name", data.get("activeSprintName", "Sprint 1"))
    data["active_sprint_name"] = active_sprint
    data["activeSprintName"] = active_sprint

    start_date = data.get("start_date", data.get("startDate", ""))
    data["start_date"] = start_date
    data["startDate"] = start_date

    if "progress" not in data:
        data["progress"] = 0

    return data
