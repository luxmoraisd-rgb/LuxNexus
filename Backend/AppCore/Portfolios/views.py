import re
from datetime import datetime, timezone
from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .db import get_portfolios_collection


DEFAULT_PORTFOLIOS = [
    {
        "_id": "pf-core-2026",
        "name": "Core Platform Modernization",
        "key": "PORT-CORE",
        "description": "Enterprise-scale UI/UX unification, distributed microservice architecture, and sub-100ms API response latency.",
        "status": "on track",
        "progress": 74,
        "priority": "High",
        "timeframe": "Q1 - Q4 FY26",
        "budget": "$340,000",
        "color": "#6366f1",
        "owner": {
            "name": "Jagadeep",
            "role": "VP of Engineering",
            "initials": "JA",
        },
        "projects": [
            {"id": "p-1", "name": "Nexus Design System 2.0", "progress": 85, "status": "on track"},
            {"id": "p-2", "name": "Distributed Event Engine", "progress": 70, "status": "on track"},
            {"id": "p-3", "name": "Edge Caching & Cloud Scale", "progress": 62, "status": "at risk"},
        ],
        "created_at": "2026-01-15T09:00:00Z",
        "updated_at": "2026-10-20T14:30:00Z",
    },
    {
        "_id": "pf-sec-2026",
        "name": "Enterprise Trust & SOC-2 Compliance",
        "key": "PORT-SEC",
        "description": "Zero-trust identity governance, end-to-end audit logging pipeline, and automated threat vulnerability remediation.",
        "status": "on track",
        "progress": 90,
        "priority": "Urgent",
        "timeframe": "Q1 - Q3 FY26",
        "budget": "$210,000",
        "color": "#10b981",
        "owner": {
            "name": "Sarah Chen",
            "role": "Security Director",
            "initials": "SC",
        },
        "projects": [
            {"id": "p-4", "name": "SOC-2 Type II Compliance", "progress": 95, "status": "on track"},
            {"id": "p-5", "name": "Zero-Trust RBAC Matrix", "progress": 88, "status": "on track"},
            {"id": "p-6", "name": "Encrypted Session Audit Store", "progress": 82, "status": "on track"},
        ],
        "created_at": "2026-02-01T10:00:00Z",
        "updated_at": "2026-10-22T11:15:00Z",
    },
    {
        "_id": "pf-mobile-2026",
        "name": "Mobile & Cross-Platform Experience",
        "key": "PORT-MOB",
        "description": "High-fidelity mobile applications for iOS and Android with seamless offline task synchronization and instant push alerts.",
        "status": "at risk",
        "progress": 48,
        "priority": "Medium",
        "timeframe": "Q2 - Q4 FY26",
        "budget": "$195,000",
        "color": "#f59e0b",
        "owner": {
            "name": "Alex Rivera",
            "role": "Lead Mobile Architect",
            "initials": "AR",
        },
        "projects": [
            {"id": "p-7", "name": "React Native Mobile Client", "progress": 55, "status": "at risk"},
            {"id": "p-8", "name": "Offline First Sync Engine", "progress": 40, "status": "off track"},
            {"id": "p-9", "name": "Rich Notification Service", "progress": 60, "status": "on track"},
        ],
        "created_at": "2026-03-10T12:00:00Z",
        "updated_at": "2026-10-21T16:45:00Z",
    },
    {
        "_id": "pf-ai-2026",
        "name": "Autonomous AI & Intelligent Workflows",
        "key": "PORT-AI",
        "description": "Context-aware coding agents, smart task triage algorithms, and real-time sprint velocity predictive models.",
        "status": "on track",
        "progress": 64,
        "priority": "High",
        "timeframe": "Q2 - Q4 FY26",
        "budget": "$275,000",
        "color": "#ec4899",
        "owner": {
            "name": "Elena Rostova",
            "role": "Head of AI Engineering",
            "initials": "ER",
        },
        "projects": [
            {"id": "p-10", "name": "Predictive Burndown Forecaster", "progress": 65, "status": "on track"},
            {"id": "p-11", "name": "Smart Backlog Triage Engine", "progress": 72, "status": "on track"},
            {"id": "p-12", "name": "Conversational Agent Sidecar", "progress": 50, "status": "at risk"},
        ],
        "created_at": "2026-04-05T08:30:00Z",
        "updated_at": "2026-10-23T09:20:00Z",
    },
]


def serialize_portfolio(doc):
    if not doc:
        return None
    data = dict(doc)
    data["id"] = str(data.get("_id", ""))
    if "_id" in data:
        del data["_id"]
    return data


def ensure_seed_portfolios(coll):
    try:
        count = coll.count_documents({})
        if count == 0:
            coll.insert_many(DEFAULT_PORTFOLIOS)
    except Exception as err:
        print("[Portfolios] Auto-seed warning:", err)


class PortfoliosView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        coll = get_portfolios_collection()
        ensure_seed_portfolios(coll)

        query = {}
        search = (request.query_params.get("search") or "").strip()
        status_filter = (request.query_params.get("status") or "").strip().lower()

        if status_filter and status_filter != "all":
            query["status"] = {"$regex": f"^{re.escape(status_filter)}$", "$options": "i"}

        if search:
            escaped = re.escape(search)
            query["$or"] = [
                {"name": {"$regex": escaped, "$options": "i"}},
                {"key": {"$regex": escaped, "$options": "i"}},
                {"description": {"$regex": escaped, "$options": "i"}},
                {"owner.name": {"$regex": escaped, "$options": "i"}},
                {"projects.name": {"$regex": escaped, "$options": "i"}},
            ]

        try:
            cursor = coll.find(query).sort("created_at", -1)
            portfolios = [serialize_portfolio(doc) for doc in cursor]
        except Exception:
            portfolios = [serialize_portfolio(doc) for doc in DEFAULT_PORTFOLIOS]

        all_cursor = coll.find({})
        all_portfolios = [serialize_portfolio(doc) for doc in all_cursor] or portfolios

        total_portfolios = len(all_portfolios)
        total_projects = sum(len(p.get("projects") or []) for p in all_portfolios)
        avg_progress = (
            round(sum(p.get("progress", 0) for p in all_portfolios) / total_portfolios)
            if total_portfolios > 0
            else 0
        )
        on_track = sum(1 for p in all_portfolios if str(p.get("status", "")).lower() == "on track")
        at_risk = sum(1 for p in all_portfolios if str(p.get("status", "")).lower() == "at risk")
        off_track = sum(1 for p in all_portfolios if str(p.get("status", "")).lower() == "off track")

        metrics = {
            "totalPortfolios": total_portfolios,
            "totalProjects": total_projects,
            "averageProgress": avg_progress,
            "onTrackCount": on_track,
            "atRiskCount": at_risk,
            "offTrackCount": off_track,
        }

        return Response(
            {
                "portfolios": portfolios,
                "metrics": metrics,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        coll = get_portfolios_collection()
        data = request.data or {}

        name = (data.get("name") or "").strip()
        if not name:
            return Response(
                {"error": "Portfolio name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = datetime.now(timezone.utc).isoformat()
        prefix = "".join([w[0].upper() for w in name.split() if w])[:4] or "PF"
        key = data.get("key") or f"PORT-{prefix}"

        owner = data.get("owner") or {}
        if isinstance(owner, str):
            owner = {
                "name": owner,
                "role": "Portfolio Lead",
                "initials": "".join([w[0].upper() for w in owner.split() if w])[:2] or "PL",
            }
        else:
            owner_name = owner.get("name") or "You"
            owner = {
                "name": owner_name,
                "role": owner.get("role") or "Portfolio Lead",
                "initials": owner.get("initials") or "".join([w[0].upper() for w in owner_name.split() if w])[:2] or "PL",
            }

        raw_projects = data.get("projects") or []
        projects = []
        for i, prj in enumerate(raw_projects):
            if isinstance(prj, str):
                projects.append({
                    "id": f"p-{datetime.now().timestamp()}-{i}",
                    "name": prj.strip(),
                    "progress": 0,
                    "status": "on track",
                })
            elif isinstance(prj, dict):
                projects.append({
                    "id": prj.get("id") or f"p-{datetime.now().timestamp()}-{i}",
                    "name": prj.get("name", "Untitled Project"),
                    "progress": int(prj.get("progress") or 0),
                    "status": prj.get("status") or "on track",
                })

        new_doc = {
            "_id": f"pf-{datetime.now().timestamp()}",
            "name": name,
            "key": key.upper(),
            "description": data.get("description", "").strip(),
            "status": data.get("status", "on track").lower(),
            "progress": int(data.get("progress", 0)),
            "priority": data.get("priority", "High"),
            "timeframe": data.get("timeframe", "Full Year 2026"),
            "budget": data.get("budget", "$150,000"),
            "color": data.get("color", "#6366f1"),
            "owner": owner,
            "projects": projects,
            "created_at": now,
            "updated_at": now,
        }

        try:
            coll.insert_one(new_doc)
            return Response(serialize_portfolio(new_doc), status=status.HTTP_201_CREATED)
        except Exception as err:
            return Response({"error": str(err)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PortfolioDetailView(APIView):
    permission_classes = [AllowAny]

    def _find_doc(self, coll, portfolio_id):
        doc = coll.find_one({"_id": portfolio_id})
        if not doc and ObjectId.is_valid(portfolio_id):
            doc = coll.find_one({"_id": ObjectId(portfolio_id)})
        if not doc:
            doc = coll.find_one({"id": portfolio_id})
        if not doc:
            doc = coll.find_one({"key": portfolio_id.upper()})
        return doc

    def get(self, request, portfolio_id):
        coll = get_portfolios_collection()
        doc = self._find_doc(coll, portfolio_id)
        if not doc:
            return Response({"detail": "Portfolio not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(serialize_portfolio(doc), status=status.HTTP_200_OK)

    def put(self, request, portfolio_id):
        coll = get_portfolios_collection()
        doc = self._find_doc(coll, portfolio_id)
        if not doc:
            return Response({"detail": "Portfolio not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data or {}
        updates = {"updated_at": datetime.now(timezone.utc).isoformat()}

        for field in ["name", "description", "status", "progress", "priority", "timeframe", "budget", "color", "owner", "projects"]:
            if field in data:
                updates[field] = data[field]

        coll.update_one({"_id": doc["_id"]}, {"$set": updates})
        updated_doc = coll.find_one({"_id": doc["_id"]})
        return Response(serialize_portfolio(updated_doc), status=status.HTTP_200_OK)

    def delete(self, request, portfolio_id):
        coll = get_portfolios_collection()
        doc = self._find_doc(coll, portfolio_id)
        if not doc:
            return Response({"detail": "Portfolio not found."}, status=status.HTTP_404_NOT_FOUND)

        coll.delete_one({"_id": doc["_id"]})
        return Response({"detail": "Portfolio deleted successfully."}, status=status.HTTP_200_OK)
