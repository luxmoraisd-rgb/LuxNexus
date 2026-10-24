from datetime import datetime, timezone
from bson import ObjectId
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..db import db


DEFAULT_PILLARS = [
    {
        "_id": "pillar-1",
        "title": "Product Experience & User Adoption",
        "description": "Drive daily active engagement through friction-free workflows, refined UI, and instant collaboration.",
        "color": "#6366f1",
        "tag": "Product Excellence",
        "targetPeriod": "Q1 - Q2 FY26",
        "weight": 35,
        "goals": [
            {
                "id": "g-1",
                "name": "Enhance Product Quality & Platform Reliability",
                "status": "on track",
                "progress": 75,
                "team": "Engineering",
                "owner": "Jagadeep",
                "dueDate": "Mar 31, 2026",
            },
            {
                "id": "g-3",
                "name": "Redesign User Onboarding & First-Run Experience",
                "status": "on track",
                "progress": 85,
                "team": "Design",
                "owner": "Alex Rivera",
                "dueDate": "Apr 15, 2026",
            },
        ],
    },
    {
        "_id": "pillar-2",
        "title": "Architecture Scale & Enterprise Security",
        "description": "Harden platform infrastructure, achieve SOC-2 Type II certification, and support 100k+ concurrent users.",
        "color": "#10b981",
        "tag": "Infrastructure",
        "targetPeriod": "Q2 - Q3 FY26",
        "weight": 25,
        "goals": [
            {
                "id": "g-2",
                "name": "Scale System Architecture to 100k DAU",
                "status": "at risk",
                "progress": 40,
                "team": "Engineering",
                "owner": "Sarah Chen",
                "dueDate": "Jun 30, 2026",
            },
            {
                "id": "g-4",
                "name": "Achieve SOC-2 Type II Compliance",
                "status": "off track",
                "progress": 20,
                "team": "Operations",
                "owner": "Michael Chang",
                "dueDate": "Sep 30, 2026",
            },
        ],
    },
    {
        "_id": "pillar-3",
        "title": "Customer Value & Enterprise Retention",
        "description": "Deepen enterprise customer relationships, improve sprint delivery predictability, and reduce churn by 15%.",
        "color": "#3b82f6",
        "tag": "Customer Success",
        "targetPeriod": "Full Year 2026",
        "weight": 25,
        "goals": [
            {
                "id": "g-5",
                "name": "Increase Enterprise Customer Retention by 15%",
                "status": "achieved",
                "progress": 100,
                "team": "Product",
                "owner": "Sarah Chen",
                "dueDate": "Dec 31, 2026",
            },
            {
                "id": "g-6",
                "name": "Deploy Automated Customer Health Score Dashboard",
                "status": "on track",
                "progress": 60,
                "team": "Product",
                "owner": "Luxmor",
                "dueDate": "Aug 31, 2026",
            },
        ],
    },
    {
        "_id": "pillar-4",
        "title": "Engineering Velocity & Quality Assurance",
        "description": "Establish continuous automated test pipelines, reduce cycle times, and eliminate regression bottlenecks.",
        "color": "#f59e0b",
        "tag": "Engineering Velocity",
        "targetPeriod": "Q3 - Q4 FY26",
        "weight": 15,
        "goals": [
            {
                "id": "g-7",
                "name": "Reach 90% Automated End-to-End Test Coverage",
                "status": "on track",
                "progress": 70,
                "team": "QA & Infrastructure",
                "owner": "Jeeva",
                "dueDate": "Oct 15, 2026",
            },
            {
                "id": "g-8",
                "name": "Reduce CI/CD Build and Deployment Latency under 5 mins",
                "status": "on track",
                "progress": 80,
                "team": "Engineering",
                "owner": "Franklin",
                "dueDate": "Nov 30, 2026",
            },
        ],
    },
]


class StrategyMapView(APIView):
    """
    API endpoint for Strategy Map visualization and strategic pillar management.
    Connects strategic company pillars with tracked goals and execution progress.
    """

    @property
    def pillars_collection(self):
        return db["strategy_pillars"]

    @property
    def goals_collection(self):
        return db["goals"]

    def get(self, request):
        # Retrieve stored pillars or seed default pillars if collection is empty
        pillars = list(self.pillars_collection.find({}))
        if not pillars:
            try:
                self.pillars_collection.insert_many(DEFAULT_PILLARS)
                pillars = list(self.pillars_collection.find({}))
            except Exception:
                pillars = DEFAULT_PILLARS

        # Format pillars
        formatted_pillars = []
        total_goals_count = 0
        total_progress_sum = 0
        on_track_count = 0
        at_risk_count = 0
        off_track_count = 0

        for p in pillars:
            p_id = str(p.get("_id", p.get("id", "")))
            p_goals = p.get("goals", [])

            # Check if there are goals in db linked to this pillar
            db_linked_goals = list(self.goals_collection.find({"pillar_id": p_id}))
            if db_linked_goals:
                for dg in db_linked_goals:
                    dg_id = str(dg.get("_id", dg.get("id", "")))
                    if not any(g.get("id") == dg_id for g in p_goals):
                        p_goals.append({
                            "id": dg_id,
                            "name": dg.get("name", "Untitled Goal"),
                            "status": dg.get("status", "on track"),
                            "progress": dg.get("progress", 0),
                            "team": dg.get("team") or dg.get("accountable_team", "General"),
                            "owner": dg.get("owner", {}).get("name") if isinstance(dg.get("owner"), dict) else str(dg.get("owner") or "Unassigned"),
                            "dueDate": dg.get("due_date") or dg.get("dueDate", ""),
                        })

            pillar_goals_count = len(p_goals)
            pillar_progress = (
                round(sum(Number(g.get("progress", 0)) for g in p_goals) / pillar_goals_count)
                if pillar_goals_count > 0
                else 0
            )

            for g in p_goals:
                total_goals_count += 1
                total_progress_sum += int(g.get("progress", 0))
                st = str(g.get("status", "")).lower()
                if "risk" in st:
                    at_risk_count += 1
                elif "off" in st:
                    off_track_count += 1
                else:
                    on_track_count += 1

            formatted_pillars.append({
                "id": p_id,
                "title": p.get("title", "Strategic Pillar"),
                "description": p.get("description", ""),
                "color": p.get("color", "#6366f1"),
                "tag": p.get("tag", "Strategy"),
                "targetPeriod": p.get("targetPeriod", "FY26"),
                "weight": p.get("weight", 25),
                "progress": pillar_progress,
                "goalsCount": pillar_goals_count,
                "goals": p_goals,
            })

        overall_alignment = (
            round(total_progress_sum / total_goals_count)
            if total_goals_count > 0
            else 75
        )

        return Response({
            "pillars": formatted_pillars,
            "metrics": {
                "totalPillars": len(formatted_pillars),
                "totalGoals": total_goals_count,
                "overallAlignment": overall_alignment,
                "onTrackCount": on_track_count,
                "atRiskCount": at_risk_count,
                "offTrackCount": off_track_count,
            },
        }, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        title = data.get("title", "").strip()
        if not title:
            return Response(
                {"error": "Title is required for strategic pillar"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_pillar = {
            "title": title,
            "description": data.get("description", "").strip(),
            "color": data.get("color", "#6366f1"),
            "tag": data.get("tag", "Strategic Goal"),
            "targetPeriod": data.get("targetPeriod", "FY26"),
            "weight": int(data.get("weight", 20)),
            "goals": data.get("goals", []),
            "created_at": datetime.now(timezone.utc),
        }

        result = self.pillars_collection.insert_one(new_pillar)
        new_pillar["id"] = str(result.inserted_id)
        new_pillar.pop("_id", None)

        return Response(new_pillar, status=status.HTTP_201_CREATED)


def Number(val):
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0
