"""
Domain Models for Agile Sprints, Boards, Views, Columns, and Tasks.
Conforms to the specification in the requirements and reference UI.
"""
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Board(models.Model):
    """Represents a project/board (e.g. LUX Tasks board)."""
    name = models.CharField(max_length=255, default="Tasks")
    key = models.CharField(max_length=20, default="LUX", help_text="Issue prefix key, e.g., LUX")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'activesprint'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.key})"

    def get_next_task_number(self):
        """Returns the next auto-incrementing task number for this board."""
        count = self.tasks.count() + 1
        return count


class Sprint(models.Model):
    """Represents a Sprint within a Board."""
    STATUS_CHOICES = (
        ('future', 'Future / Ready to start'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    )

    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='sprints')
    name = models.CharField(max_length=255, help_text="e.g. Sprint 1, Sprint 2")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='future')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    duration_text = models.CharField(max_length=100, blank=True, default="", help_text="e.g. Oct 1 - Oct 8 (1 week)")
    goals = models.TextField(blank=True, default="", help_text="Sprint goals entered by user")
    capacity_limit = models.IntegerField(default=20, help_text="Max Story Points planned for this sprint")
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'activesprint'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.name} [{self.status}]"

    @property
    def total_sp(self):
        """Sum of estimated story points of tasks in this sprint."""
        return sum(t.estimated_sp for t in self.tasks.all())

    @property
    def issues_count(self):
        """Number of issues in this sprint."""
        return self.tasks.count()


class BoardView(models.Model):
    """Represents different views (Backlog, Kanban, Active Sprint, Custom views)."""
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='views')
    name = models.CharField(max_length=255, help_text="e.g. Backlog, Kanban, Active Sprint")
    view_type = models.CharField(max_length=50, default="backlog", help_text="backlog, kanban, active_sprint, all_sprints, custom")
    is_custom = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    
    # Filter state
    # e.g.: {"status": ["Ready to start", "In Progress"], "type": ["Feature"], "owner_id": 1, "unassigned": False}
    filters = models.JSONField(default=dict, blank=True)
    
    # Sorting state
    # e.g.: [{"columnId": "task_id", "direction": "Ascending"}]
    sorting = models.JSONField(default=list, blank=True)
    
    # Grouping state
    # e.g.: {"columnId": "status", "direction": "Ascending"}
    grouping = models.JSONField(default=dict, blank=True)
    
    # Hidden columns list of column IDs or names
    hidden_columns = models.JSONField(default=list, blank=True)
    
    # Options settings: pin columns, item height, conditional coloring, default item values
    options = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'activesprint'
        ordering = ['id']

    def __str__(self):
        return f"{self.name} ({self.view_type}) - Board {self.board_id}"


class BoardColumn(models.Model):
    """Represents a column in a board view (Task, Owner, Status, Type, etc.)."""
    TYPE_CHOICES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('status', 'Status'),
        ('label', 'Label'),
        ('user', 'User / Owner'),
        ('date', 'Date'),
        ('dropdown', 'Dropdown'),
    )

    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=255)
    column_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='text')
    order = models.IntegerField(default=0)
    is_hidden = models.BooleanField(default=False)
    settings = models.JSONField(default=dict, blank=True, help_text="Column width, formatting, validation rules")
    extensions = models.JSONField(default=dict, blank=True, help_text="Extensions, integrations, automation hooks")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'activesprint'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.name} ({self.column_type})"


class Task(models.Model):
    """Represents a backlog or sprint issue/task."""
    STATUS_CHOICES = (
        ('Ready to start', 'Ready to start'),
        ('In Progress', 'In Progress'),
        ('In Review', 'In Review'),
        ('Done', 'Done'),
    )

    TYPE_CHOICES = (
        ('Task', 'Task'),
        ('Feature', 'Feature'),
        ('Quality', 'Quality'),
        ('Bug', 'Bug'),
    )

    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='tasks')
    sprint = models.ForeignKey(Sprint, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    task_key = models.CharField(max_length=50, blank=True, help_text="e.g. LUX-004")
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Ready to start')
    task_type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='Task')
    estimated_sp = models.IntegerField(default=3, help_text="Estimated Story Points")
    epic = models.CharField(max_length=255, blank=True, default="")
    comments_count = models.IntegerField(default=0)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'activesprint'
        ordering = ['order', 'id']

    def __str__(self):
        return f"[{self.task_key}] {self.title}"

    def save(self, *args, **kwargs):
        if not self.task_key and self.board:
            # Auto-assign task_key e.g. LUX-004
            total = self.board.tasks.count() + 1
            self.task_key = f"{self.board.key}-{total:03d}"
        super().save(*args, **kwargs)
