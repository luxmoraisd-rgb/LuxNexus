"""
Comprehensive automated test suite for Agile Sprints & Board Views API.
Tests all endpoints from Sections 01 through 05.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from appcore.models import Board, Sprint, BoardView, BoardColumn, Task

User = get_user_model()


class AgileBoardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.user_s = User.objects.create_user(username='sarah', first_name='Sarah', last_name='Smith')
        self.user_franklin = User.objects.create_user(username='franklin', first_name='Franklin', last_name='Delano')
        
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

    def test_create_sprint(self):
        payload = {
            "name": "Sprint 3",
            "board_id": self.board.id,
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
        payload = {"user_id": self.user_s.id}
        res = self.client.put(f'/api/views/{self.view_backlog.id}/filters/person', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.filters.get('owner_id'), self.user_s.id)

    def test_save_custom_view(self):
        payload = {
            "board_id": self.board.id,
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
        payload = {"hidden_columns": [self.col_epic.id]}
        res = self.client.put(f'/api/views/{self.view_backlog.id}/hide-columns', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.view_backlog.refresh_from_db()
        self.assertEqual(self.view_backlog.hidden_columns, [self.col_epic.id])

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
            "board_id": self.board.id,
            "sprint_id": self.sprint_1.id,
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
            self.assertEqual(res.data.get("database"), "agile_backlog_db")

    def test_mongodb_sync_endpoint(self):
        res = self.client.post('/api/mongodb/sync')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get("status"), "synced")
        self.assertGreaterEqual(res.data.get("tasks_synced"), 5)

