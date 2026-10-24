from django.urls import path
from rest_framework.routers import DefaultRouter
from ..views import GoalViewSet, StrategyMapView, TeamGoalsView

router = DefaultRouter()
router.register("goals", GoalViewSet, basename="goal")

urlpatterns = [
    path("strategy-map/", StrategyMapView.as_view(), name="strategy-map"),
    path("team-goals/", TeamGoalsView.as_view(), name="team-goals"),
] + router.urls
