"""
Management command to seed initial database with data from Image 1.
Includes LUX board, Sprint 1 (5 tasks, 15 SP sum), Sprint 2 (Active, 0 issues),
all default columns, and all standard view tabs.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ...models import Board, Sprint, BoardColumn, BoardView, Task

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds database with agile board data from Image 1"

    def handle(self, *args, **options):
        self.stdout.write("Seeding agile board database...")

        # 1. Users
        user_s, _ = User.objects.get_or_create(username='sarah', defaults={
            'first_name': 'Sarah',
            'last_name': 'Jenkins',
            'email': 'sarah@example.com'
        })
        user_franklin, _ = User.objects.get_or_create(username='franklin', defaults={
            'first_name': 'Franklin',
            'last_name': 'Roosevelt',
            'email': 'franklin@example.com'
        })
        user_me, _ = User.objects.get_or_create(username='me', defaults={
            'first_name': 'Me',
            'last_name': 'Developer',
            'email': 'me@example.com'
        })

        # 2. Board
        board, _ = Board.objects.get_or_create(
            key="LUX",
            defaults={
                "name": "Tasks",
                "description": "Product engineering sprint & backlog board"
            }
        )

        # 3. Columns matching Image 1
        columns_data = [
            ("Task", "text", 1),
            ("Owner", "user", 2),
            ("Status", "status", 3),
            ("Type", "label", 4),
            ("Task ID", "text", 5),
            ("Estimated SP", "number", 6),
            ("Epic", "text", 7),
            ("Actions", "text", 8),
        ]
        for name, col_type, order in columns_data:
            BoardColumn.objects.get_or_create(
                board=board,
                name=name,
                defaults={
                    "column_type": col_type,
                    "order": order,
                    "settings": {"width": 160},
                    "extensions": {}
                }
            )

        # 4. Board Views matching tabs from Image 1 and Image 4
        views_data = [
            ("Backlog", "backlog", True),
            ("Kanban", "kanban", False),
            ("Active Sprint", "active_sprint", False),
            ("All Sprints", "all_sprints", False),
            ("Hierarchy", "hierarchy", False),
            ("Roadmap tracker", "roadmap", False),
            ("Calendar", "calendar", False),
            ("Chart", "chart", False),
            ("Doc", "doc", False),
        ]
        for name, view_type, is_def in views_data:
            BoardView.objects.get_or_create(
                board=board,
                name=name,
                defaults={
                    "view_type": view_type,
                    "is_default": is_def,
                    "options": {
                        "pin_columns": True,
                        "item_height": "medium",
                        "conditional_coloring": True,
                        "default_item_values": {"estimated_sp": 3}
                    }
                }
            )

        # 5. Sprints matching Image 1
        sprint_1, _ = Sprint.objects.get_or_create(
            board=board,
            name="Sprint 1",
            defaults={
                "status": "future",
                "duration_text": "Oct 1 - Oct 8 (1 week)",
                "capacity_limit": 20,
                "order": 1,
                "goals": "Core auth, signin, signup, and kanban API completion"
            }
        )

        sprint_2, _ = Sprint.objects.get_or_create(
            board=board,
            name="Sprint 2",
            defaults={
                "status": "active",
                "duration_text": "Oct 9 - Oct 16 (1 week)",
                "capacity_limit": 20,
                "order": 2,
                "goals": "Sprint 2 active development"
            }
        )

        # 6. Tasks matching Image 1
        tasks_spec = [
            ("LUX-004", "create a backlog page", "Task", "Ready to start", 3, 3, "+ Epic", 1),
            ("LUX-006", "create a signin page", "Feature", "Ready to start", 3, 0, "+ Epic", 2),
            ("LUX-007", "create a signup page", "Feature", "Ready to start", 3, 0, "+ Epic", 3),
            ("LUX-008", "create a forgot password page", "Feature", "Ready to start", 3, 0, "+ Epic", 4),
            ("LUX-009", "create a api for kanban", "Feature", "Ready to start", 3, 1, "+ Epic", 5),
        ]

        for key, title, ttype, status_val, sp, comments, epic, order in tasks_spec:
            Task.objects.get_or_create(
                board=board,
                task_key=key,
                defaults={
                    "title": title,
                    "sprint": sprint_1,
                    "owner": user_s,
                    "status": status_val,
                    "task_type": ttype,
                    "estimated_sp": sp,
                    "comments_count": comments,
                    "epic": epic,
                    "order": order
                }
            )

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded database! Board: {board.name} ({board.key}), Sprints: 2, Tasks: {Task.objects.count()}"
        ))
