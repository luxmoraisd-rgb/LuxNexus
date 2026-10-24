from django.urls import path

from AppCore.views.views import (
    CapacityPlanningView,
    ResourceAllocationDetailView,
    ResourceAllocationListCreateView,
    ResourcingProjectDetailView,
    ResourcingProjectListCreateView,
)

urlpatterns = [
    path("resourcing/projects/", ResourcingProjectListCreateView.as_view(), name="resourcing-project-list-create"),
    path("resourcing/projects/<str:project_id>/", ResourcingProjectDetailView.as_view(), name="resourcing-project-detail"),
    path("resourcing/allocations/", ResourceAllocationListCreateView.as_view(), name="allocation-list-create"),
    path("resourcing/allocations/<str:allocation_id>/", ResourceAllocationDetailView.as_view(), name="allocation-detail"),
    path("resourcing/capacity/", CapacityPlanningView.as_view(), name="capacity-planning"),
]
