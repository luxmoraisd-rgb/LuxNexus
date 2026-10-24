from django.urls import path, include
from rest_framework.routers import SimpleRouter

from ..views.views import AllSprintsOverviewView, SprintViewSet, TaskViewSet


router = SimpleRouter()
router.register(r'sprints', SprintViewSet, basename='allsprint-sprint')
router.register(r'tasks', TaskViewSet, basename='allsprint-task')

urlpatterns = [
    path('', AllSprintsOverviewView.as_view(), name='all-sprints-overview'),
    path('overview/', AllSprintsOverviewView.as_view(), name='all-sprints-overview-alias'),
    path('', include(router.urls)),
]