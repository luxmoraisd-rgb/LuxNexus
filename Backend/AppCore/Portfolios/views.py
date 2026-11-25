import re
from datetime import datetime, timezone

from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..Auth.role_permissions import RoleModulePermission
from ..project_access import (
    get_accessible_projects,
    is_project_admin,
)
from .db import get_portfolios_collection


def serialize_portfolio(document):
    if not document:
        return None
    data = dict(document)
    data["id"] = str(data.pop("_id", data.get("id", "")))
    return data


def _metrics(portfolios):
    total = len(portfolios)
    return {
        "totalPortfolios": total,
        "totalProjects": sum(len(item.get("projects") or []) for item in portfolios),
        "averageProgress": round(sum(item.get("progress", 0) for item in portfolios) / total) if total else 0,
        "onTrackCount": sum(str(item.get("status", "")).lower() == "on track" for item in portfolios),
        "atRiskCount": sum(str(item.get("status", "")).lower() == "at risk" for item in portfolios),
        "offTrackCount": sum(str(item.get("status", "")).lower() == "off track" for item in portfolios),
    }


def _portfolio_is_accessible(user, document, accessible_projects=None):
    if is_project_admin(user):
        return True
    if accessible_projects is None:
        accessible_projects = get_accessible_projects(user) or []
    project_identifiers = set()
    project_names = set()
    for project in accessible_projects:
        for value in (project.get("_id"), project.get("id"), project.get("key")):
            if value is not None:
                project_identifiers.add(str(value).strip().casefold())
        name = str(project.get("name") or "").strip().casefold()
        if name:
            project_names.add(name)

    portfolio_projects = document.get("projects") or []
    if not portfolio_projects:
        return False
    for project in portfolio_projects:
        if isinstance(project, dict):
            identifiers = tuple(
                project.get(field) for field in ("id", "key") if project.get(field)
            )
            if identifiers:
                allowed = all(
                    str(value).strip().casefold() in project_identifiers
                    for value in identifiers
                )
            else:
                allowed = (
                    str(project.get("name") or "").strip().casefold()
                    in project_names
                )
        else:
            value = str(project or "").strip().casefold()
            allowed = value in project_identifiers or value in project_names
        if not allowed:
            return False
    return True


class PortfoliosView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def get(self, request):
        collection = get_portfolios_collection()
        accessible_projects = (
            None
            if is_project_admin(request.user)
            else get_accessible_projects(request.user) or []
        )
        query = {}
        status_filter = (request.query_params.get("status") or "").strip().lower()
        search = (request.query_params.get("search") or "").strip()
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
        documents = [
            document
            for document in collection.find(query)
            if _portfolio_is_accessible(request.user, document, accessible_projects)
        ]
        documents.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
        portfolios = [serialize_portfolio(document) for document in documents]
        all_portfolios = [
            serialize_portfolio(document)
            for document in collection.find({})
            if _portfolio_is_accessible(request.user, document, accessible_projects)
        ]
        return Response(
            {"portfolios": portfolios, "metrics": _metrics(all_portfolios)},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        collection = get_portfolios_collection()
        data = request.data or {}
        name = (data.get("name") or "").strip()
        if not name:
            return Response(
                {"error": "Portfolio name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = datetime.now(timezone.utc).isoformat()
        prefix = "".join(word[0].upper() for word in name.split() if word)[:4]
        owner = data.get("owner") or {}
        if isinstance(owner, str):
            owner = {"name": owner, "role": "", "initials": ""}
        projects = []
        for index, project in enumerate(data.get("projects") or []):
            if isinstance(project, str):
                projects.append(
                    {
                        "id": f"p-{datetime.now().timestamp()}-{index}",
                        "name": project.strip(),
                        "progress": 0,
                        "status": "",
                    }
                )
            elif isinstance(project, dict):
                projects.append(
                    {
                        "id": project.get("id") or f"p-{datetime.now().timestamp()}-{index}",
                        "name": project.get("name", ""),
                        "progress": int(project.get("progress") or 0),
                        "status": project.get("status", ""),
                    }
                )

        if not is_project_admin(request.user):
            access_document = {"projects": projects}
            if not _portfolio_is_accessible(request.user, access_document):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You do not have access to one or more projects.")

        document = {
            "_id": f"pf-{datetime.now().timestamp()}",
            "name": name,
            "key": (data.get("key") or f"PORT-{prefix}").upper(),
            "description": (data.get("description") or "").strip(),
            "status": (data.get("status") or "").lower(),
            "progress": int(data.get("progress") or 0),
            "priority": data.get("priority", ""),
            "timeframe": data.get("timeframe", ""),
            "budget": data.get("budget", ""),
            "color": data.get("color", ""),
            "owner": owner,
            "projects": projects,
            "created_at": now,
            "updated_at": now,
        }
        collection.insert_one(document)
        return Response(serialize_portfolio(document), status=status.HTTP_201_CREATED)


class PortfolioDetailView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

    @staticmethod
    def _find_document(collection, portfolio_id):
        document = collection.find_one({"_id": portfolio_id})
        if document is None and ObjectId.is_valid(portfolio_id):
            document = collection.find_one({"_id": ObjectId(portfolio_id)})
        if document is None:
            document = collection.find_one({"id": portfolio_id})
        if document is None:
            document = collection.find_one({"key": portfolio_id.upper()})
        return document

    def get(self, request, portfolio_id):
        document = self._find_document(get_portfolios_collection(), portfolio_id)
        if document is None:
            return Response({"detail": "Portfolio not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _portfolio_is_accessible(request.user, document):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have access to this project.")
        return Response(serialize_portfolio(document), status=status.HTTP_200_OK)

    def put(self, request, portfolio_id):
        collection = get_portfolios_collection()
        document = self._find_document(collection, portfolio_id)
        if document is None:
            return Response({"detail": "Portfolio not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _portfolio_is_accessible(request.user, document):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have access to this project.")
        updates = {
            key: value
            for key, value in (request.data or {}).items()
            if key in {"name", "description", "status", "progress", "priority", "timeframe", "budget", "color", "owner", "projects"}
        }
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        if "projects" in updates and not _portfolio_is_accessible(
            request.user, {"projects": updates["projects"]}
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have access to one or more projects.")
        collection.update_one({"_id": document["_id"]}, {"$set": updates})
        updated = collection.find_one({"_id": document["_id"]})
        return Response(serialize_portfolio(updated), status=status.HTTP_200_OK)

    def delete(self, request, portfolio_id):
        collection = get_portfolios_collection()
        document = self._find_document(collection, portfolio_id)
        if document is None:
            return Response({"detail": "Portfolio not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _portfolio_is_accessible(request.user, document):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You do not have access to this project.")
        collection.delete_one({"_id": document["_id"]})
        return Response({"detail": "Portfolio deleted successfully."}, status=status.HTTP_200_OK)
