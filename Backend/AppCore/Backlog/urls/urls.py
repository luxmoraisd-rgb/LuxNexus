"""
URL patterns for appcore module matching all specifications in Images 2, 3, and 4.
Supports both trailing and non-trailing slashes for maximum client compatibility.
"""
from django.urls import re_path
from ..views import (
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
    ProjectKeyView,
    BoardAssetListCreateView,
    BoardAssetDetailView,
    BoardAssetDownloadView,
    TaskCreateListView,
    TaskDetailView,
    TaskMoveView,
    TaskBatchUpdateView,
    TaskCommentView,
    TaskCommentDetailView,
    SprintDetailView,
    SprintCompleteView,
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
    re_path(r'^boards/(?P<board_id>[0-9a-fA-F]{24})/sprints/?$', BoardSprintsView.as_view(), name='board-sprints'),
    re_path(r'^sprints/last-created/?$', SprintLastCreatedView.as_view(), name='sprint-last-created'),
    re_path(r'^sprints/(?P<sprint_id>[0-9a-fA-F]{24})/dates/?$', SprintDatesUpdateView.as_view(), name='sprint-dates'),
    re_path(r'^sprints/(?P<sprint_id>[0-9a-fA-F]{24})/goals/?$', SprintGoalsUpdateView.as_view(), name='sprint-goals'),
    re_path(r'^sprints/(?P<sprint_id>[0-9a-fA-F]{24})/start/?$', SprintStartView.as_view(), name='sprint-start'),
    re_path(r'^sprints/(?P<sprint_id>[0-9a-fA-F]{24})/complete/?$', SprintCompleteView.as_view(), name='sprint-complete'),
    re_path(r'^sprints/(?P<sprint_id>[0-9a-fA-F]{24})/capacity/?$', SprintCapacityView.as_view(), name='sprint-capacity'),
    re_path(r'^sprints/(?P<sprint_id>[0-9a-fA-F]{24})/?$', SprintDetailView.as_view(), name='sprint-detail'),
    re_path(r'^sprints/?$', SprintCreateView.as_view(), name='sprint-create'),

    # =========================================================================
    # 02 BOARD FILTERING & SEARCH
    # =========================================================================
    re_path(r'^boards/(?P<board_id>[0-9a-fA-F]{24})/search/?$', BoardSearchView.as_view(), name='board-search'),
    re_path(r'^boards/(?P<board_id>[0-9a-fA-F]{24})/filters/?$', BoardFilterMetadataView.as_view(), name='board-filters'),
    re_path(r'^views/(?P<view_id>[0-9a-fA-F]{24})/filters/person/?$', ViewFilterPersonView.as_view(), name='view-filter-person'),
    re_path(r'^views/(?P<view_id>[0-9a-fA-F]{24})/filters/?$', ViewFiltersUpdateView.as_view(), name='view-filters'),
    re_path(r'^views/save/?$', ViewSaveCustomView.as_view(), name='view-save-custom'),
    re_path(r'^users/?$', UserListView.as_view(), name='users-list'),

    # =========================================================================
    # 03 SORTING CONFIGURATION
    # =========================================================================
    re_path(r'^boards/(?P<board_id>[0-9a-fA-F]{24})/sort-options/?$', BoardSortOptionsView.as_view(), name='board-sort-options'),
    re_path(r'^views/(?P<view_id>[0-9a-fA-F]{24})/sort/?$', ViewSortView.as_view(), name='view-sort'),

    # =========================================================================
    # 04 BOARD VIEW & COLUMN OPTIONS
    # =========================================================================
    re_path(r'^boards/(?P<board_id>[0-9a-fA-F]{24})/views/?$', BoardViewsListView.as_view(), name='board-views'),
    re_path(r'^views/(?P<view_id>[0-9a-fA-F]{24})/hide-columns/?$', ViewHideColumnsView.as_view(), name='view-hide-columns'),
    re_path(r'^views/(?P<view_id>[0-9a-fA-F]{24})/group/?$', ViewGroupingView.as_view(), name='view-group'),
    re_path(r'^views/(?P<view_id>[0-9a-fA-F]{24})/options/?$', ViewOptionsView.as_view(), name='view-options'),

    # =========================================================================
    # 05 TASK MANAGEMENT & COLUMN OPERATIONS
    # =========================================================================
    re_path(r'^project-key/?$', ProjectKeyView.as_view(), name='project-key'),
    re_path(r'^board-assets/(?P<asset_id>[0-9a-fA-F]{24})/download/?$', BoardAssetDownloadView.as_view(), name='board-asset-download'),
    re_path(r'^board-assets/(?P<asset_id>[0-9a-fA-F]{24})/?$', BoardAssetDetailView.as_view(), name='board-asset-detail'),
    re_path(r'^board-assets/?$', BoardAssetListCreateView.as_view(), name='board-assets'),
    re_path(r'^tasks/batch/?$', TaskBatchUpdateView.as_view(), name='task-batch'),
    re_path(r'^tasks/(?P<task_id>[0-9a-fA-F]{24})/move/?$', TaskMoveView.as_view(), name='task-move'),
    re_path(r'^tasks/(?P<task_id>[0-9a-fA-F]{24})/comments/(?P<comment_id>[^/]+)/?$', TaskCommentDetailView.as_view(), name='task-comment-detail'),
    re_path(r'^tasks/(?P<task_id>[0-9a-fA-F]{24})/comments/?$', TaskCommentView.as_view(), name='task-comments'),
    re_path(r'^tasks/(?P<task_id>[0-9a-fA-F]{24})/?$', TaskDetailView.as_view(), name='task-detail'),
    re_path(r'^tasks/?$', TaskCreateListView.as_view(), name='tasks-list-create'),
    re_path(r'^columns/(?P<column_id>[0-9a-fA-F]{24})/duplicate/?$', ColumnDuplicateView.as_view(), name='column-duplicate'),
    re_path(r'^columns/(?P<column_id>[0-9a-fA-F]{24})/type/?$', ColumnTypeUpdateView.as_view(), name='column-type'),
    re_path(r'^columns/(?P<column_id>[0-9a-fA-F]{24})/extensions/?$', ColumnExtensionsView.as_view(), name='column-extensions'),
    re_path(r'^columns/(?P<column_id>[0-9a-fA-F]{24})/settings/?$', ColumnSettingsView.as_view(), name='column-settings'),
    re_path(r'^columns/(?P<column_id>[0-9a-fA-F]{24})/?$', ColumnDetailView.as_view(), name='column-detail'),
    re_path(r'^columns/?$', ColumnCreateView.as_view(), name='columns-create'),

    # =========================================================================
    # MONGODB HEALTH CHECK & SYNC
    # =========================================================================
    re_path(r'^mongodb/check/?$', MongoHealthCheckView.as_view(), name='mongo-check'),
    re_path(r'^mongodb/sync/?$', MongoSyncView.as_view(), name='mongo-sync'),
    re_path(r'^health/?$', MongoHealthCheckView.as_view(), name='backlog-health'),
]
