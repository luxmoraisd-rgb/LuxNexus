"""
Comprehensive automated test suite for Agile Sprints & Board Views API.
Tests all endpoints from Sections 01 through 05.
"""
from io import BytesIO
from unittest.mock import patch
from zipfile import ZipFile

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from bson import ObjectId
from .models import Board, Sprint, BoardView, BoardColumn, Task

User = get_user_model()


class AgileBoardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.user_s = User.objects.create_user(username='sarah', first_name='Sarah', last_name='Smith')
        self.user_franklin = User.objects.create_user(username='franklin', first_name='Franklin', last_name='Delano')
        self.user_s.role = "admin"
        self.user_s.is_staff = True
        self.user_s.save(update_fields=["is_staff"])
        self.client.force_authenticate(user=self.user_s)
        
        # Create Board
        self.board = Board.objects.create(name="Tasks", key="LUX", description="Main Product Board")

        # Create Columns matching Image 1
        self.col_task = BoardColumn.objects.create(board=self.board, name="Task", column_type="text", order=1)
        self.col_owner = BoardColumn.objects.create(board=self.board, name="Owner", column_type="user", order=2)
        self.col_status = BoardColumn.objects.create(board=self.board, name="Status", column_type="status", order=3)
        self.col_type = BoardColumn.objects.create(board=self.board, name="Type", column_type="label", order=4)
        self.col_task_id = BoardColumn.objects.create(board=self.board, name="Task ID", column_type="text", order=5)
        self.col_sp = BoardColumn.objects.create(board=self.board, name="Estimated SP", column_type="number", order=6)
        self.col_epic = BoardColumn.objects.create(board=self.board, name="Epic", column_type="text", order=7)

        # Create Views
        self.view_backlog = BoardView.objects.create(board=self.board, name="Backlog", view_type="backlog", is_default=True)
        self.view_kanban = BoardView.objects.create(board=self.board, name="Kanban", view_type="kanban")
        self.view_active = BoardView.objects.create(board=self.board, name="Active Sprint", view_type="active_sprint")

        # Create Sprints matching Image 1
        self.sprint_1 = Sprint.objects.create(
            board=self.board,
            name="Sprint 1",
            status="future",
            duration_text="Oct 1 - Oct 8 (1 week)",
            capacity_limit=20,
            order=1
        )
        self.sprint_2 = Sprint.objects.create(
            board=self.board,
            name="Sprint 2",
            status="active",
            duration_text="",
            capacity_limit=20,
            order=2
        )

        # Create Tasks matching Image 1
        self.tasks_data = [
            ("LUX-004", "create a backlog page", "Task", 3, 3),
            ("LUX-006", "create a signin page", "Feature", 3, 0),
            ("LUX-007", "create a signup page", "Feature", 3, 0),
            ("LUX-008", "create a forgot password page", "Feature", 3, 0),
            ("LUX-009", "create a api for kanban", "Feature", 3, 1),
        ]
        for key, title, ttype, sp, comments in self.tasks_data:
            Task.objects.create(
                board=self.board,
                sprint=self.sprint_1,
                task_key=key,
                title=title,
                owner=self.user_s,
                status="Ready to start",
                task_type=ttype,
                estimated_sp=sp,
                comments_count=comments
            )

    # --------------------------------------------------------------------------
    # 01 SPRINT MANAGEMENT & CREATION TESTS
    # --------------------------------------------------------------------------
    def test_fetch_sprints_for_board(self):
        response = self.client.get(f'/api/boards/{self.board.id}/sprints')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['name'], "Sprint 1")

    def test_frontend_backlog_endpoints(self):
        sprints_res = self.client.get('/api/backlog/sprints')
        self.assertEqual(sprints_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sprints_res.data[0]['isStarted'], False)
        self.assertEqual(sprints_res.data[0]['dates'], self.sprint_1.duration_text)

        tasks_res = self.client.get('/api/backlog/tasks')
        self.assertEqual(tasks_res.status_code, status.HTTP_200_OK)
        task = tasks_res.data[0]
        self.assertIn('taskId', task)
        self.assertIn('type', task)
        self.assertIn('sp', task)
        self.assertIn('sprintId', task)
        self.assertIn('name', task['owner'])

        key_res = self.client.put(
            '/api/backlog/project-key',
            {'projectKey': 'nex'},
            format='json',
        )
        self.assertEqual(key_res.status_code, status.HTTP_200_OK)
        self.assertEqual(key_res.data['projectKey'], 'NEX')
        self.assertEqual(
            self.client.get('/api/backlog/project-key').data['projectKey'],
            'NEX',
        )

    def test_default_project_key_is_lux(self):
        self.assertEqual(Board._meta.get_field('key').get_default(), 'LUX')
        response = self.client.get('/api/backlog/project-key')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['projectKey'], 'LUX')

    def test_admin_can_create_kanban_task_in_selected_sprint(self):
        response = self.client.post(
            '/api/backlog/tasks',
            {
                'title': 'Kanban inline task',
                'taskId': 'LUX-010',
                'status': 'Ready to start',
                'type': 'Frontend',
                'sp': 3,
                'sprintId': str(self.sprint_2.id),
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'Kanban inline task')
        self.assertEqual(response.data['status'], 'Ready to start')
        self.assertEqual(str(response.data['sprintId']), str(self.sprint_2.id))

    def test_create_backlog_task_accepts_frontend_backlog_sprint_marker(self):
        response = self.client.post(
            '/api/backlog/tasks',
            {
                'id': 'task-local-123',
                'title': 'Kanban backlog task',
                'taskId': 'LUX-011',
                'status': 'Ready to start',
                'type': 'Frontend',
                'sp': None,
                'sprintId': 'backlog',
                'comments': [],
                'githubLink': '',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['title'], 'Kanban backlog task')
        self.assertEqual(response.data['taskId'], 'LUX-011')
        self.assertIsNone(response.data['sprintId'])
        self.assertEqual(response.data['sp'], 3)

    @patch("AppCore.Backlog.views.views.GridFSBucket")
    @patch("AppCore.Backlog.views.views.get_database")
    def test_upload_file_bundle_is_saved_as_zip(self, get_database, gridfs_bucket):
        database = get_database.return_value
        archive_id = ObjectId()
        uploaded_archive = {}

        def save_archive(_filename, stream, metadata):
            uploaded_archive["bytes"] = stream.read()
            uploaded_archive["metadata"] = metadata
            return archive_id

        gridfs_bucket.return_value.upload_from_stream.side_effect = save_archive
        database.board_assets.insert_one.return_value.inserted_id = ObjectId()

        response = self.client.post(
            "/api/backlog/board-assets/",
            {
                "kind": "archive",
                "task_id": "42",
                "files": [
                    SimpleUploadedFile("notes.txt", b"ready-to-start notes"),
                    SimpleUploadedFile("design.txt", b"design details"),
                ],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["filename"].rsplit(".", 1)[-1], "zip")
        self.assertEqual(response.data["file_count"], 2)
        self.assertEqual(response.data["task_id"], "42")
        self.assertEqual(
            response.data["download_url"],
            f"/api/backlog/board-assets/{database.board_assets.insert_one.return_value.inserted_id}/download/",
        )
        with ZipFile(BytesIO(uploaded_archive["bytes"])) as archive:
            self.assertEqual(archive.namelist(), ["notes.txt", "design.txt"])
            self.assertEqual(archive.read("notes.txt"), b"ready-to-start notes")
        self.assertEqual(uploaded_archive["metadata"]["content_type"], "application/zip")
        database.board_assets.insert_one.assert_called_once()
        saved_asset = database.board_assets.insert_one.call_args.args[0]
        self.assertEqual(saved_asset["task_id"], "42")
        self.assertEqual(
            database.board_assets.update_one.call_args.args[1]["$set"]["download_url"],
            response.data["download_url"],
        )

    @patch("AppCore.Backlog.views.views.get_database")
    def test_upload_link_is_saved_to_board_assets(self, get_database):
        database = get_database.return_value
        database.board_assets.insert_one.return_value.inserted_id = ObjectId()

        response = self.client.post(
            "/api/backlog/board-assets/",
            {
                "kind": "link",
                "task_id": "42",
                "title": "Project design",
                "url": "https://example.com/design",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["kind"], "link")
        self.assertEqual(response.data["task_id"], "42")
        self.assertEqual(response.data["title"], "Project design")
        self.assertEqual(response.data["url"], "https://example.com/design")
        self.assertEqual(database.board_assets.insert_one.call_args.args[0]["task_id"], "42")

    @patch("AppCore.Backlog.views.views.get_database")
    def test_task_attachments_are_filtered_by_task_id(self, get_database):
        database = get_database.return_value

        response = self.client.get("/api/backlog/board-assets/?task_id=42")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        database.board_assets.find.assert_called_once_with({"task_id": "42"})

    @patch("AppCore.Backlog.views.views.GridFSBucket")
    @patch("AppCore.Backlog.views.views.get_database")
    def test_saved_zip_can_be_downloaded(self, get_database, gridfs_bucket):
        database = get_database.return_value
        asset_id = ObjectId()
        database.board_assets.find_one.return_value = {
            "_id": asset_id,
            "kind": "archive",
            "filename": "ready-to-start-files.zip",
            "gridfs_id": ObjectId(),
        }
        gridfs_bucket.return_value.open_download_stream.return_value = BytesIO(b"zip contents")

        response = self.client.get(f"/api/backlog/board-assets/{asset_id}/download/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/zip")
        self.assertIn("ready-to-start-files.zip", response["Content-Disposition"])
        self.assertEqual(b"".join(response.streaming_content), b"zip contents")

    @patch("AppCore.Backlog.views.views.GridFSBucket")
    @patch("AppCore.Backlog.views.views.get_database")
    def test_delete_task_zip_removes_archive_and_asset_record(self, get_database, gridfs_bucket):
        database = get_database.return_value
        asset_id = ObjectId()
        gridfs_id = ObjectId()
        database.board_assets.find_one.return_value = {
            "_id": asset_id,
            "kind": "archive",
            "gridfs_id": gridfs_id,
        }

        response = self.client.delete(f"/api/backlog/board-assets/{asset_id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        gridfs_bucket.return_value.delete.assert_called_once_with(gridfs_id)
        database.board_assets.delete_one.assert_called_once_with({"_id": asset_id})

    @patch("AppCore.Backlog.views.views.get_database")
    def test_delete_task_link_removes_asset_record(self, get_database):
        database = get_database.return_value
        asset_id = ObjectId()
        database.board_assets.find_one.return_value = {
            "_id": asset_id,
            "kind": "link",
            "url": "https://example.com/design",
        }

        response = self.client.delete(f"/api/backlog/board-assets/{asset_id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        database.board_assets.delete_one.assert_called_once_with({"_id": asset_id})

    @patch("AppCore.Backlog.views.views.get_database")
    def test_delete_missing_task_attachment_returns_not_found(self, get_database):
        database = get_database.return_value
        database.board_assets.find_one.return_value = None
        asset_id = ObjectId()

        response = self.client.delete(f"/api/backlog/board-assets/{asset_id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        database.board_assets.delete_one.assert_not_called()

    def test_create_sprint(self):
        payload = {
            "name": "Sprint 3",
            "board_id": str(self.board.id),
            "duration_text": "Oct 15 - Oct 29 (2 weeks)"
        }
        response = self.client.post('/api/sprints', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], "Sprint 3")
        self.assertEqual(response.data['status'], "future")

    def test_fetch_last_sprint_metadata(self):
        response = self.client.get('/api/sprints/last-created')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("suggested_next_name", response.data)

    def test_update_sprint_dates(self):
        payload = {"duration_text": "5 Oct - 19 Oct"}
        response = self.client.put(f'/api/sprints/{self.sprint_1.id}/dates', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sprint_1.refresh_from_db()
        self.assertEqual(self.sprint_1.duration_text, "5 Oct - 19 Oct")

    def test_update_sprint_goals(self):
        payload = {"goals": "Deliver MVP authentication and backlog UI"}
        response = self.client.put(f'/api/sprints/{self.sprint_1.id}/goals', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sprint_1.refresh_from_db()
        self.assertEqual(self.sprint_1.goals, payload['goals'])

    def test_start_sprint(self):
        response = self.client.post(f'/api/sprints/{self.sprint_1.id}/start')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sprint_1.refresh_from_db()
        self.assertEqual(self.sprint_1.status, "active")

    def test_fetch_and_update_sprint_capacity(self):
        # Fetch capacity (Sprint 1 has 5 tasks with 3 SP each = 15 SP)
        get_res = self.client.get(f'/api/sprints/{self.sprint_1.id}/capacity')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data['total_sp'], 15)
        self.assertEqual(get_res.data['capacity_label'], "15 SP sum")

        # Update capacity limit
        put_res = self.client.put(f'/api/sprints/{self.sprint_1.id}/capacity', {"capacity_limit": 25}, format='json')
        self.assertEqual(put_res.status_code, status.HTTP_200_OK)
        self.sprint_1.refresh_from_db()
        self.assertEqual(self.sprint_1.capacity_limit, 25)

    # --------------------------------------------------------------------------
    # 02 BOARD FILTERING & SEARCH TESTS
    # --------------------------------------------------------------------------
    def test_board_search(self):
        response = self.client.get(f'/api/boards/{self.board.id}/search?q=signin')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_matches'], 1)
        self.assertEqual(response.data['tasks'][0]['task_key'], "LUX-006")

    def test_board_filters_metadata(self):
        response = self.client.get(f'/api/boards/{self.board.id}/filters')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("statuses", response.data)
        self.assertIn("types", response.data)
        self.assertIn("owners", response.data)

    def test_apply_and_clear_quick_filters(self):
        payload = {"status": ["Ready to start"], "task_type": ["Feature"]}
        res = self.client.post(f'/api/views/{self.view_backlog.id}/filters', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.filters, payload)

        del_res = self.client.delete(f'/api/views/{self.view_backlog.id}/filters')
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.filters, {})

    def test_filter_board_by_person(self):
        payload = {"user_id": str(self.user_s.id)}
        res = self.client.put(f'/api/views/{self.view_backlog.id}/filters/person', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.filters.get('owner_id'), str(self.user_s.id))

    def test_save_custom_view(self):
        payload = {
            "board_id": str(self.board.id),
            "name": "My Custom Bugs View",
            "filters": {"task_type": ["Bug"]},
            "view_type": "custom"
        }
        res = self.client.post('/api/views/save', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['is_custom'])
        self.assertEqual(res.data['name'], "My Custom Bugs View")

    def test_fetch_users(self):
        res = self.client.get('/api/users')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 2)

    # --------------------------------------------------------------------------
    # 03 SORTING CONFIGURATION TESTS
    # --------------------------------------------------------------------------
    def test_fetch_sort_options(self):
        res = self.client.get(f'/api/boards/{self.board.id}/sort-options')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res.data['sort_options']) > 0)

    def test_view_sort_operations(self):
        # Update primary sort
        put_res = self.client.put(f'/api/views/{self.view_backlog.id}/sort', {"columnId": "task_key", "direction": "Ascending"}, format='json')
        self.assertEqual(put_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(put_res.data['sorting']), 1)

        # Add secondary sort
        post_res = self.client.post(f'/api/views/{self.view_backlog.id}/sort', {"columnId": "estimated_sp", "direction": "Descending"}, format='json')
        self.assertEqual(post_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(post_res.data['sorting']), 2)

        # Clear sorting
        del_res = self.client.delete(f'/api/views/{self.view_backlog.id}/sort')
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(del_res.data['sorting']), 0)

    # --------------------------------------------------------------------------
    # 04 BOARD VIEW & COLUMN OPTIONS TESTS
    # --------------------------------------------------------------------------
    def test_fetch_board_views(self):
        res = self.client.get(f'/api/boards/{self.board.id}/views')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 3)

    def test_hide_columns(self):
        payload = {"hidden_columns": [str(self.col_epic.id)]}
        res = self.client.put(f'/api/views/{self.view_backlog.id}/hide-columns', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.hidden_columns, [str(self.col_epic.id)])

    def test_apply_grouping(self):
        res = self.client.put(f'/api/views/{self.view_backlog.id}/group', {"columnId": "status"}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.grouping.get('columnId'), "status")

    def test_board_options(self):
        # Fetch options
        get_res = self.client.get(f'/api/views/{self.view_backlog.id}/options')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data.get('pin_columns'))

        # Update options
        put_res = self.client.put(f'/api/views/{self.view_backlog.id}/options', {"item_height": "compact"}, format='json')
        self.assertEqual(put_res.status_code, status.HTTP_200_OK)
        self.assertEqual(put_res.data['options']['item_height'], "compact")

    # --------------------------------------------------------------------------
    # 05 TASK MANAGEMENT & COLUMN OPERATIONS TESTS
    # --------------------------------------------------------------------------
    def test_create_and_manage_task(self):
        # Create task
        payload = {
            "title": "Create unit tests for board",
            "board_id": str(self.board.id),
            "sprint_id": str(self.sprint_1.id),
            "task_type": "Quality",
            "estimated_sp": 2
        }
        res = self.client.post('/api/tasks', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        task_id = res.data['id']

        # Update task
        update_res = self.client.put(f'/api/tasks/{task_id}', {"status": "In Progress"}, format='json')
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.data['status'], "In Progress")

        # Delete task
        del_res = self.client.delete(f'/api/tasks/{task_id}')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_column_operations(self):
        # Rename column
        res_rename = self.client.put(f'/api/columns/{self.col_epic.id}', {"name": "Epic / Category"}, format='json')
        self.assertEqual(res_rename.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rename.data['name'], "Epic / Category")

        # Duplicate column
        res_dup = self.client.post(f'/api/columns/{self.col_epic.id}/duplicate')
        self.assertEqual(res_dup.status_code, status.HTTP_201_CREATED)
        dup_id = res_dup.data['id']

        # Change column type
        res_type = self.client.put(f'/api/columns/{dup_id}/type', {"column_type": "dropdown"}, format='json')
        self.assertEqual(res_type.status_code, status.HTTP_200_OK)
        self.assertEqual(res_type.data['column_type'], "dropdown")

        # Get extensions
        res_ext = self.client.get(f'/api/columns/{dup_id}/extensions')
        self.assertEqual(res_ext.status_code, status.HTTP_200_OK)

        # Update settings
        res_set = self.client.put(f'/api/columns/{dup_id}/settings', {"width": 220}, format='json')
        self.assertEqual(res_set.status_code, status.HTTP_200_OK)

        # Remove column
        res_del = self.client.delete(f'/api/columns/{dup_id}')
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

    # --------------------------------------------------------------------------
    # MONGODB HEALTH CHECK & SYNC TESTS
    # --------------------------------------------------------------------------
    def test_mongodb_check_endpoint(self):
        res = self.client.get('/api/mongodb/check')
        self.assertIn(res.status_code, [status.HTTP_200_OK, status.HTTP_503_SERVICE_UNAVAILABLE])
        self.assertIn("status", res.data)
        if res.status_code == status.HTTP_200_OK:
            self.assertTrue(res.data.get("ok"))
            self.assertEqual(res.data.get("database"), settings.MONGODB_DATABASE)

    def test_mongodb_sync_endpoint(self):
        res = self.client.post('/api/mongodb/sync')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get("status"), "synced")
        self.assertGreaterEqual(res.data.get("tasks_synced"), 5)
