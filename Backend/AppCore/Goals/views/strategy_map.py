from datetime import datetime, timezone
from bson import ObjectId
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..db import db


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
        pillars = list(self.pillars_collection.find({}))

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
                            "name": dg.get("name", ""),
                            "status": dg.get("status", ""),
                            "progress": dg.get("progress", 0),
                            "team": dg.get("team") or dg.get("accountable_team", ""),
                            "owner": dg.get("owner", {}).get("name") if isinstance(dg.get("owner"), dict) else str(dg.get("owner") or ""),
                            "dueDate": dg.get("due_date") or dg.get("dueDate", ""),
                            "timePeriod": dg.get("time_period") or dg.get("timePeriod", ""),
                            "statusSummary": dg.get("status_summary") or dg.get("statusSummary", ""),
                            "comments": dg.get("comments", []),
                        })

            pillar_goals_count = len(p_goals)
            pillar_progress = (
                round(sum(float(g.get("progress", 0)) for g in p_goals) / pillar_goals_count)
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
                "title": p.get("title", ""),
                "description": p.get("description", ""),
                "color": p.get("color", "#6366f1"),
                "tag": p.get("tag", ""),
                "targetPeriod": p.get("targetPeriod", ""),
                "weight": p.get("weight", 0),
                "progress": pillar_progress,
                "goalsCount": pillar_goals_count,
                "goals": p_goals,
            })

        overall_alignment = (
            round(total_progress_sum / total_goals_count)
            if total_goals_count > 0
            else 0
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
            "tag": data.get("tag", ""),
            "targetPeriod": data.get("targetPeriod", ""),
            "weight": int(data.get("weight", 0)),
            "goals": data.get("goals", []),
            "created_at": datetime.now(timezone.utc),
        }

        result = self.pillars_collection.insert_one(new_pillar)
        new_pillar["id"] = str(result.inserted_id)
        new_pillar.pop("_id", None)

        return Response(new_pillar, status=status.HTTP_201_CREATED)
