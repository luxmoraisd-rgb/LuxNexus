from datetime import datetime, time, timezone
from decimal import Decimal

from bson import ObjectId
from bson.decimal128 import Decimal128
from django.http import JsonResponse
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..Auth.utils import user_payload as _user_payload
from ..api_utils import validation_error as _validation_error
from ..db import get_database, ping_database
from ..serializers.serializers import AllocationInputSerializer, ProjectInputSerializer


def health_check(_request):
    try:
        ping_database()
    except PyMongoError:
        return JsonResponse(
            {"status": "error", "message": "MongoDB is unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return JsonResponse(
        {"status": "ok", "message": "NexusApp backend is running"}
    )


def _date_time(value):
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def _iso_date(value):
    return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()


def _hours_value(value):
    if isinstance(value, Decimal128):
        value = value.to_decimal()
    if isinstance(value, Decimal):
        return format(value, ".2f")
    return format(Decimal(str(value)), ".2f")


def _allocation_payload(document):
    database = get_database()
    user = database.users.find_one({"_id": document["user"]})
    return {
        "id": str(document["_id"]),
        "project": str(document["project"]),
        "user": str(document["user"]),
        "user_details": _user_payload(user) if user else None,
        "month": _iso_date(document["month"]),
        "hours": _hours_value(document["hours"]),
    }


def _project_payload(document, include_allocations=True, capacity=False):
    database = get_database()
    output = {
        "id": str(document["_id"]),
        "name": document["name"],
        "start_date": _iso_date(document["start_date"]),
        "end_date": _iso_date(document["end_date"]),
    }

    if capacity:
        allocations = database.allocations.find(
            {"project": document["_id"]}
        ).sort([("month", ASCENDING)])
        output["allocations"] = []
        for allocation in allocations:
            user = database.users.find_one({"_id": allocation["user"]})
            output["allocations"].append(
                {
                    "id": str(allocation["_id"]),
                    "user": (
                        {
                            "id": str(user["_id"]),
                            "username": user["username"],
                            "email": user["email"],
                        }
                        if user
                        else None
                    ),
                    "month": _iso_date(allocation["month"]),
                    "hours": _hours_value(allocation["hours"]),
                }
            )
        return output

    owner = database.users.find_one({"_id": document["created_by"]})
    output.update(
        {
            "created_by": _user_payload(owner) if owner else None,
            "created_at": document["created_at"].isoformat(),
            "updated_at": document["updated_at"].isoformat(),
            "allocations": [],
        }
    )
    if include_allocations:
        allocations = database.allocations.find(
            {"project": document["_id"]}
        ).sort([("month", ASCENDING)])
        output["allocations"] = [
            _allocation_payload(allocation) for allocation in allocations
        ]
    return output


def _get_user_id(request):
    if hasattr(request, "user") and request.user and getattr(request.user, "is_authenticated", False):
        return getattr(request.user, "id", None)
    return None


class ResourcingProjectListCreateView(APIView):
    def get(self, request):
        database = get_database()
        user_id = _get_user_id(request)
        query = (
            {"$or": [{"created_by": user_id}, {"created_by": None}, {"created_by": {"$exists": False}}]}
            if user_id
            else {}
        )
        projects = database.projects.find(query).sort([("start_date", ASCENDING), ("name", ASCENDING)])
        return Response(
            [_project_payload(project) for project in projects],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = ProjectInputSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error(serializer)

        now = datetime.now(timezone.utc)
        user_id = _get_user_id(request) or ObjectId("000000000000000000000000")
        document = {
            **serializer.validated_data,
            "start_date": _date_time(serializer.validated_data["start_date"]),
            "end_date": _date_time(serializer.validated_data["end_date"]),
            "created_by": user_id,
            "created_at": now,
            "updated_at": now,
        }
        document["_id"] = get_database().projects.insert_one(document).inserted_id
        return Response(
            _project_payload(document),
            status=status.HTTP_201_CREATED,
        )


def _owned_project(project_id, user_id):
    if not ObjectId.is_valid(project_id):
        return None
    db = get_database()
    if user_id:
        project = db.projects.find_one({"_id": ObjectId(project_id), "created_by": user_id})
        if project:
            return project
    return db.projects.find_one({"_id": ObjectId(project_id)})


class ResourcingProjectDetailView(APIView):
    def get(self, request, project_id):
        project = _owned_project(project_id, _get_user_id(request))
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_project_payload(project), status=status.HTTP_200_OK)

    def put(self, request, project_id):
        project = _owned_project(project_id, _get_user_id(request))
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ProjectInputSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error(serializer)
        values = serializer.validated_data
        updated_at = datetime.now(timezone.utc)
        get_database().projects.update_one(
            {"_id": project["_id"]},
            {
                "$set": {
                    "name": values["name"],
                    "start_date": _date_time(values["start_date"]),
                    "end_date": _date_time(values["end_date"]),
                    "updated_at": updated_at,
                }
            },
        )
        project.update(
            {
                "name": values["name"],
                "start_date": _date_time(values["start_date"]),
                "end_date": _date_time(values["end_date"]),
                "updated_at": updated_at,
            }
        )
        return Response(_project_payload(project), status=status.HTTP_200_OK)

    def delete(self, request, project_id):
        project = _owned_project(project_id, _get_user_id(request))
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        database = get_database()
        database.allocations.delete_many({"project": project["_id"]})
        database.projects.delete_one({"_id": project["_id"]})
        return Response(
            {"message": "Project deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )


class ResourceAllocationListCreateView(APIView):
    def get(self, request):
        database = get_database()
        allocations = database.allocations.find().sort([("month", ASCENDING)])
        return Response(
            [_allocation_payload(item) for item in allocations],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = AllocationInputSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error(serializer)
        values = serializer.validated_data
        database = get_database()
        project_id = ObjectId(values["project"])
        project = database.projects.find_one({"_id": project_id})
        if project is None:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        user_id = ObjectId(values["user"])

        now = datetime.now(timezone.utc)
        document = {
            "project": project_id,
            "user": user_id,
            "month": _date_time(values["month"]),
            "hours": Decimal128(values["hours"]),
            "created_at": now,
            "updated_at": now,
        }
        try:
            document["_id"] = database.allocations.insert_one(document).inserted_id
        except DuplicateKeyError:
            return Response(
                {
                    "detail": (
                        "An allocation already exists for this project, user, "
                        "and month."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            _allocation_payload(document),
            status=status.HTTP_201_CREATED,
        )


def _owned_allocation(allocation_id, user_id):
    if not ObjectId.is_valid(allocation_id):
        return None
    database = get_database()
    allocation = database.allocations.find_one({"_id": ObjectId(allocation_id)})
    if allocation is None:
        return None
    if user_id:
        project = database.projects.find_one(
            {"_id": allocation["project"], "created_by": user_id},
            {"_id": 1},
        )
        if project:
            return allocation
    return allocation


class ResourceAllocationDetailView(APIView):
    def get(self, request, allocation_id):
        allocation = _owned_allocation(allocation_id, _get_user_id(request))
        if allocation is None:
            return Response(
                {"detail": "Allocation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            _allocation_payload(allocation),
            status=status.HTTP_200_OK,
        )

    def put(self, request, allocation_id):
        allocation = _owned_allocation(allocation_id, _get_user_id(request))
        if allocation is None:
            return Response(
                {"detail": "Allocation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = AllocationInputSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error(serializer)
        values = serializer.validated_data
        project_id = ObjectId(values["project"])
        user_id = ObjectId(values["user"])
        updated_at = datetime.now(timezone.utc)
        update = {
            "project": project_id,
            "user": user_id,
            "month": _date_time(values["month"]),
            "hours": Decimal128(values["hours"]),
            "updated_at": updated_at,
        }
        try:
            get_database().allocations.update_one(
                {"_id": allocation["_id"]},
                {"$set": update},
            )
        except DuplicateKeyError:
            return Response(
                {
                    "detail": (
                        "An allocation already exists for this project, user, "
                        "and month."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        allocation.update(update)
        return Response(
            _allocation_payload(allocation),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, allocation_id):
        allocation = _owned_allocation(allocation_id, _get_user_id(request))
        if allocation is None:
            return Response(
                {"detail": "Allocation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        get_database().allocations.delete_one({"_id": allocation["_id"]})
        return Response(
            {"message": "Allocation deleted successfully."},
            status=status.HTTP_204_NO_CONTENT,
        )


class CapacityPlanningView(APIView):
    def get(self, request):
        user_id = _get_user_id(request)
        query = (
            {"$or": [{"created_by": user_id}, {"created_by": None}, {"created_by": {"$exists": False}}]}
            if user_id
            else {}
        )
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        if start:
            start_filter = ProjectInputSerializer(
                data={
                    "name": "filter",
                    "start_date": start,
                    "end_date": start,
                }
            )
            if not start_filter.is_valid():
                return _validation_error(start_filter)
            query["end_date"] = {
                "$gte": _date_time(start_filter.validated_data["start_date"])
            }
        if end:
            end_date = ProjectInputSerializer(
                data={"name": "filter", "start_date": end, "end_date": end}
            )
            if not end_date.is_valid():
                return _validation_error(end_date)
            query["start_date"] = {
                "$lte": _date_time(end_date.validated_data["end_date"])
            }
        projects = get_database().projects.find(query).sort(
            [("start_date", ASCENDING), ("name", ASCENDING)]
        )
        return Response(
            [_project_payload(project, capacity=True) for project in projects],
            status=status.HTTP_200_OK,
        )
