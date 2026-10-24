"""
URL patterns for appcore module matching all specifications in Images 2, 3, and 4.
Supports both trailing and non-trailing slashes for maximum client compatibility.
"""
from django.urls import re_path
from appcore.views import (
    # 01 Sprint Management & Creation
    BoardSprintsView,
    SprintCreateView,
    SprintLastCreatedView,
    SprintDatesUpdateView,
    SprintGoalsUpdateView,
    SprintStartView,
    SprintCapacityView,
    # 02 Board Filtering & Search
    BoardSearchView,
    BoardFilterMetadataView,
    ViewFiltersUpdateView,
    ViewFilterPersonView,
    ViewSaveCustomView,
    UserListView,
    # 03 Sorting Configuration
    BoardSortOptionsView,
    ViewSortView,
    # 04 Board View & Column Options
    BoardViewsListView,
    ViewHideColumnsView,
    ViewGroupingView,
    ViewOptionsView,
    # 05 Task Management & Column Operations
    TaskCreateListView,
    TaskDetailView,
    ColumnCreateView,
    ColumnDetailView,
    ColumnDuplicateView,
    ColumnTypeUpdateView,
    ColumnExtensionsView,
    ColumnSettingsView,
    # MongoDB check & sync
    MongoHealthCheckView,
    MongoSyncView,
)

urlpatterns = [
    # =========================================================================
    # 01 SPRINT MANAGEMENT & CREATION
    # =========================================================================
    re_path(r'^boards/(?P<board_id>\d+)/sprints/?$', BoardSprintsView.as_view(), name='board-sprints'),
    re_path(r'^sprints/last-created/?$', SprintLastCreatedView.as_view(), name='sprint-last-created'),
    re_path(r'^sprints/(?P<sprint_id>\d+)/dates/?$', SprintDatesUpdateView.as_view(), name='sprint-dates'),
    re_path(r'^sprints/(?P<sprint_id>\d+)/goals/?$', SprintGoalsUpdateView.as_view(), name='sprint-goals'),
    re_path(r'^sprints/(?P<sprint_id>\d+)/start/?$', SprintStartView.as_view(), name='sprint-start'),
    re_path(r'^sprints/(?P<sprint_id>\d+)/capacity/?$', SprintCapacityView.as_view(), name='sprint-capacity'),
    re_path(r'^sprints/?$', SprintCreateView.as_view(), name='sprint-create'),

    # =========================================================================
    # 02 BOARD FILTERING & SEARCH
    # =========================================================================
    re_path(r'^boards/(?P<board_id>\d+)/search/?$', BoardSearchView.as_view(), name='board-search'),
    re_path(r'^boards/(?P<board_id>\d+)/filters/?$', BoardFilterMetadataView.as_view(), name='board-filters'),
    re_path(r'^views/(?P<view_id>\d+)/filters/person/?$', ViewFilterPersonView.as_view(), name='view-filter-person'),
    re_path(r'^views/(?P<view_id>\d+)/filters/?$', ViewFiltersUpdateView.as_view(), name='view-filters'),
    re_path(r'^views/save/?$', ViewSaveCustomView.as_view(), name='view-save-custom'),
    re_path(r'^users/?$', UserListView.as_view(), name='users-list'),

    # =========================================================================
    # 03 SORTING CONFIGURATION
    # =========================================================================
    re_path(r'^boards/(?P<board_id>\d+)/sort-options/?$', BoardSortOptionsView.as_view(), name='board-sort-options'),
    re_path(r'^views/(?P<view_id>\d+)/sort/?$', ViewSortView.as_view(), name='view-sort'),

    # =========================================================================
    # 04 BOARD VIEW & COLUMN OPTIONS
    # =========================================================================
    re_path(r'^boards/(?P<board_id>\d+)/views/?$', BoardViewsListView.as_view(), name='board-views'),
    re_path(r'^views/(?P<view_id>\d+)/hide-columns/?$', ViewHideColumnsView.as_view(), name='view-hide-columns'),
    re_path(r'^views/(?P<view_id>\d+)/group/?$', ViewGroupingView.as_view(), name='view-group'),
    re_path(r'^views/(?P<view_id>\d+)/options/?$', ViewOptionsView.as_view(), name='view-options'),

    # =========================================================================
    # 05 TASK MANAGEMENT & COLUMN OPERATIONS
    # =========================================================================
    re_path(r'^tasks/(?P<task_id>\d+)/?$', TaskDetailView.as_view(), name='task-detail'),
    re_path(r'^tasks/?$', TaskCreateListView.as_view(), name='tasks-list-create'),
    re_path(r'^columns/(?P<column_id>\d+)/duplicate/?$', ColumnDuplicateView.as_view(), name='column-duplicate'),
    re_path(r'^columns/(?P<column_id>\d+)/type/?$', ColumnTypeUpdateView.as_view(), name='column-type'),
    re_path(r'^columns/(?P<column_id>\d+)/extensions/?$', ColumnExtensionsView.as_view(), name='column-extensions'),
    re_path(r'^columns/(?P<column_id>\d+)/settings/?$', ColumnSettingsView.as_view(), name='column-settings'),
    re_path(r'^columns/(?P<column_id>\d+)/?$', ColumnDetailView.as_view(), name='column-detail'),
    re_path(r'^columns/?$', ColumnCreateView.as_view(), name='columns-create'),

    # =========================================================================
    # MONGODB HEALTH CHECK & SYNC
    # =========================================================================
    re_path(r'^mongodb/check/?$', MongoHealthCheckView.as_view(), name='mongo-check'),
    re_path(r'^mongodb/sync/?$', MongoSyncView.as_view(), name='mongo-sync'),
]

