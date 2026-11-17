from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..db import db


DEFAULT_TEAM_GOALS = [
    {
        "_id": "tg-1",
        "name": "Deliver Automated CI/CD Pipeline & 85% Code Coverage",
        "status": "on track",
        "progress": 80,
        "team": "Engineering",
        "accountable_team": "Engineering",
        "timePeriod": "Q1 FY26",
        "owner": {"name": "Franklin", "initials": "FR", "role": "Backend Lead"},
        "dueDate": "Mar 31, 2026",
        "statusSummary": "Pipelines deployed; automated tests running on every pull request.",
    },
    {
        "_id": "tg-2",
        "name": "Design System Tokenization & Accessibility Compliance",
        "status": "on track",
        "progress": 75,
        "team": "Design",
        "accountable_team": "Design",
        "timePeriod": "Q1 FY26",
        "owner": {"name": "Alex Rivera", "initials": "AR", "role": "Design Lead"},
        "dueDate": "Apr 15, 2026",
        "statusSummary": "Core component library tokenized with full keyboard and screen-reader support.",
    },
    {
        "_id": "tg-3",
        "name": "Enterprise Multi-Tenancy & Data Isolation Audit",
        "status": "at risk",
        "progress": 45,
        "team": "Engineering",
        "accountable_team": "Engineering",
        "timePeriod": "Q2 FY26",
        "owner": {"name": "Sarah Chen", "initials": "SC", "role": "Architect"},
        "dueDate": "May 30, 2026",
        "statusSummary": "Awaiting tenant credential migration verification.",
    },
    {
        "_id": "tg-4",
        "name": "Product Analytics & Funnel Drop-off Telemetry",
        "status": "on track",
        "progress": 90,
        "team": "Product",
        "accountable_team": "Product",
        "timePeriod": "Q1 FY26",
        "owner": {"name": "Luxmor", "initials": "LX", "role": "Product Admin"},
        "dueDate": "Apr 30, 2026",
        "statusSummary": "Event tracking instruments live across all onboarding funnels.",
    },
    {
        "_id": "tg-5",
        "name": "Zero-Downtime Deployment & Chaos Testing Protocol",
        "status": "on track",
        "progress": 65,
        "team": "Operations",
        "accountable_team": "Operations",
        "timePeriod": "Q2 FY26",
        "owner": {"name": "Michael Chang", "initials": "MC", "role": "DevOps Lead"},
        "dueDate": "Jun 15, 2026",
        "statusSummary": "Automated rollback tests passed in staging environment.",
    },
    {
        "_id": "tg-6",
        "name": "Regression Test Automation for Sprints & Task Flows",
        "status": "on track",
        "progress": 70,
        "team": "QA & Infrastructure",
        "accountable_team": "QA & Infrastructure",
        "timePeriod": "Q2 FY26",
        "owner": {"name": "Jeeva", "initials": "JV", "role": "QA Lead"},
        "dueDate": "Jun 30, 2026",
        "statusSummary": "Over 120 integration tests automated and running in CI.",
    },
]


class TeamGoalsView(APIView):
    """
    API endpoint for Team Goals management and team-level OKR aggregation.
    """

    @property
    def goals_collection(self):
        return db["goals"]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        cursor = list(self.goals_collection.find({}))
        if not cursor:
            try:
                self.goals_collection.insert_many(DEFAULT_TEAM_GOALS)
                cursor = list(self.goals_collection.find({}))
            except Exception:
                cursor = DEFAULT_TEAM_GOALS

        # Group goals by team
        teams_map = {}
        total_goals = 0
        total_completed = 0
        total_progress = 0

        for doc in cursor:
            doc_id = str(doc.get("_id", doc.get("id", "")))
            team_name = doc.get("team") or doc.get("accountable_team") or "General Team"
            if not team_name.strip():
                team_name = "General Team"

            if team_name not in teams_map:
                teams_map[team_name] = {
                    "teamName": team_name,
                    "goals": [],
                    "totalGoals": 0,
                    "completedGoals": 0,
                    "progressSum": 0,
                    "onTrackCount": 0,
                    "atRiskCount": 0,
                    "offTrackCount": 0,
                }

            status_val = str(doc.get("status", "on track")).lower()
            progress_val = int(doc.get("progress", 0))
            is_done = progress_val >= 100 or "achieved" in status_val or "done" in status_val

            total_goals += 1
            total_progress += progress_val
            if is_done:
                total_completed += 1

            t_data = teams_map[team_name]
            t_data["totalGoals"] += 1
            t_data["progressSum"] += progress_val
            if is_done:
                t_data["completedGoals"] += 1

            if "risk" in status_val:
                t_data["atRiskCount"] += 1
            elif "off" in status_val:
                t_data["offTrackCount"] += 1
            else:
                t_data["onTrackCount"] += 1

            owner = doc.get("owner")
            owner_name = owner.get("name") if isinstance(owner, dict) else str(owner or "Team Member")
            owner_initials = owner.get("initials") if isinstance(owner, dict) else owner_name[:2].upper()

            t_data["goals"].append({
                "id": doc_id,
                "name": doc.get("name", "Untitled Team Goal"),
                "status": doc.get("status", "on track"),
                "progress": progress_val,
                "team": team_name,
                "timePeriod": doc.get("timePeriod") or doc.get("time_period", "FY26"),
                "owner": {"name": owner_name, "initials": owner_initials},
                "dueDate": doc.get("dueDate") or doc.get("due_date", ""),
                "statusSummary": doc.get("statusSummary") or doc.get("status_summary", ""),
            })

        teams_list = []
        for t_name, t_info in teams_map.items():
            count = t_info["totalGoals"]
            avg_progress = round(t_info["progressSum"] / count) if count > 0 else 0
            health = "On Track"
            if t_info["offTrackCount"] > 0:
                health = "Needs Attention"
            elif t_info["atRiskCount"] > 0:
                health = "At Risk"

            teams_list.append({
                "teamName": t_name,
                "totalGoals": count,
                "completedGoals": t_info["completedGoals"],
                "averageProgress": avg_progress,
                "health": health,
                "onTrackCount": t_info["onTrackCount"],
                "atRiskCount": t_info["atRiskCount"],
                "offTrackCount": t_info["offTrackCount"],
                "goals": t_info["goals"],
            })

        overall_percent = round((total_completed / total_goals) * 100) if total_goals > 0 else 0
        overall_progress = round(total_progress / total_goals) if total_goals > 0 else 0

        return Response({
            "teams": teams_list,
            "metrics": {
                "totalTeams": len(teams_list),
                "totalGoals": total_goals,
                "completedGoals": total_completed,
                "overallCompletionPercent": overall_percent,
                "overallAverageProgress": overall_progress,
            },
        }, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        name = data.get("name", "").strip()
        team = data.get("team", "").strip() or "Engineering"
        if not name:
            return Response(
                {"error": "Goal name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_goal = {
            "name": name,
            "status": data.get("status", "on track"),
            "progress": int(data.get("progress", 0)),
            "team": team,
            "accountable_team": team,
            "timePeriod": data.get("timePeriod", "Q2 FY26"),
            "time_period": data.get("timePeriod", "Q2 FY26"),
            "owner": data.get("owner", {"name": "Team Member", "initials": "TM"}),
            "dueDate": data.get("dueDate", ""),
            "due_date": data.get("dueDate", ""),
            "statusSummary": data.get("statusSummary", ""),
            "status_summary": data.get("statusSummary", ""),
            "comments": [],
            "created_at": datetime.now(timezone.utc),
        }

        result = self.goals_collection.insert_one(new_goal)
        new_goal["id"] = str(result.inserted_id)
        new_goal.pop("_id", None)

        return Response(new_goal, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        user_email = str(getattr(request.user, "email", "")).strip().lower()
        if user_email != "franklin@gmail.com":
            return Response(
                {"error": "Only Franklin can edit team goals."},
                status=status.HTTP_403_FORBIDDEN,
            )

        allowed_fields = {
            "name",
            "status",
            "progress",
            "timePeriod",
            "time_period",
            "dueDate",
            "due_date",
            "owner",
        }
        unsupported_fields = set(request.data) - allowed_fields
        if unsupported_fields:
            return Response(
                {"error": "Only title, status, progress, period, due date, and owner can be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updates = {}
        if "name" in request.data:
            name = str(request.data["name"]).strip()
            if not name or len(name) > 255:
                return Response(
                    {"error": "Goal title must contain 1–255 characters."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["name"] = name

        if "status" in request.data:
            goal_status = str(request.data["status"]).strip().lower()
            if goal_status not in {"on track", "at risk", "off track", "achieved"}:
                return Response(
                    {"error": "Invalid goal status."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["status"] = goal_status

        if "progress" in request.data:
            raw_progress = request.data["progress"]
            is_integer = (
                isinstance(raw_progress, int)
                and not isinstance(raw_progress, bool)
            ) or (
                isinstance(raw_progress, float)
                and raw_progress.is_integer()
            ) or (
                isinstance(raw_progress, str)
                and raw_progress.strip().lstrip("+-").isdigit()
            )
            try:
                progress = int(raw_progress)
            except (TypeError, ValueError):
                is_integer = False
                progress = -1
            if not is_integer:
                return Response(
                    {"error": "Progress must be an integer from 0 to 100."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not 0 <= progress <= 100:
                return Response(
                    {"error": "Progress must be an integer from 0 to 100."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["progress"] = progress

        if "timePeriod" in request.data or "time_period" in request.data:
            period = request.data.get("timePeriod", request.data.get("time_period"))
            if not isinstance(period, str):
                return Response(
                    {"error": "Period must be text."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["timePeriod"] = period
            updates["time_period"] = period

        if "dueDate" in request.data or "due_date" in request.data:
            due_date = request.data.get("dueDate", request.data.get("due_date"))
            if not isinstance(due_date, str):
                return Response(
                    {"error": "Due date must be text."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["dueDate"] = due_date
            updates["due_date"] = due_date

        if "owner" in request.data:
            owner = request.data["owner"]
            if owner is None:
                updates["owner"] = None
            elif isinstance(owner, str):
                owner_name = owner.strip()
                updates["owner"] = (
                    {
                        "name": owner_name,
                        "initials": owner_name[:2].upper(),
                    }
                    if owner_name
                    else None
                )
            elif isinstance(owner, dict):
                owner_name = str(owner.get("name", "")).strip()
                if not owner_name:
                    return Response(
                        {"error": "Owner name cannot be blank."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                updates["owner"] = {
                    **owner,
                    "name": owner_name,
                    "initials": str(owner.get("initials") or owner_name[:2].upper()),
                }
            else:
                return Response(
                    {"error": "Owner must be a name or owner object."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not updates:
            return Response(
                {"error": "At least one editable field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            object_id = ObjectId(pk)
        except (InvalidId, TypeError):
            object_id = None

        lookup_ids = [pk]
        if object_id is not None:
            lookup_ids.insert(0, object_id)
        existing = None
        for goal_id in lookup_ids:
            existing = self.goals_collection.find_one({"_id": goal_id})
            if existing:
                break

        if not existing:
            return Response(
                {"error": "Goal not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        updates["updated_at"] = datetime.now(timezone.utc)
        updated = self.goals_collection.find_one_and_update(
            {"_id": existing["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        updated["id"] = str(updated.pop("_id"))
        updated["timePeriod"] = updated.get("timePeriod") or updated.get("time_period", "")
        updated["dueDate"] = updated.get("dueDate") or updated.get("due_date", "")
        return Response(updated, status=status.HTTP_200_OK)
