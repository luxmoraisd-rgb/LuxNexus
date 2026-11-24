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

    active_sprint = data.get("active_sprint_name", data.get("activeSprintName", ""))
    data["active_sprint_name"] = active_sprint
    data["activeSprintName"] = active_sprint

    start_date = data.get("start_date", data.get("startDate", ""))
    data["start_date"] = start_date
    data["startDate"] = start_date

    end_date = data.get("end_date", data.get("endDate", ""))
    data["end_date"] = end_date
    data["endDate"] = end_date
    data["status"] = data.get("status", "Active")
    lead = data.get("lead", data.get("project_lead", ""))
    data["lead"] = lead
    data["project_lead"] = lead

    if "progress" not in data:
        data["progress"] = 0

    return data
