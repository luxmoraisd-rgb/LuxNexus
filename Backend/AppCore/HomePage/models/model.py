from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

class Workspace(models.Model):
    """
    Workspace representing teams or organization spaces (e.g., 'Work').
    """
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_workspaces')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Workspace'
        verbose_name_plural = 'Workspaces'

    def __str__(self):
        return self.name


class Project(models.Model):
    """
    Projects holding tasks (e.g., "Franklin's first project").
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('archived', 'Archived'),
    ]

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='projects', null=True, blank=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_projects')
    members = models.ManyToManyField(User, related_name='assigned_projects', blank=True)
    color = models.CharField(max_length=50, default='#4F46E5')
    icon = models.CharField(max_length=50, default='list')  # 'list', 'board', 'calendar'
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'

    def __str__(self):
        return self.name

    @property
    def total_tasks_count(self):
        return self.tasks.count()

    @property
    def tasks_due_soon_count(self):
        """Tasks due within the next 7 days or overdue, not yet completed."""
        today = timezone.now().date()
        cutoff = today + timedelta(days=7)
        return self.tasks.filter(
            is_completed=False,
            due_date__isnull=False,
            due_date__lte=cutoff
        ).count()

    @property
    def completed_tasks_count(self):
        return self.tasks.filter(is_completed=True).count()


class Task(models.Model):
    """
    Task model representing items in 'My tasks' and projects.
    """
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    STATUS_CATEGORY_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('overdue', 'Overdue'),
        ('completed', 'Completed'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks', null=True, blank=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.SET_NULL, related_name='tasks', null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tasks')
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    status_category = models.CharField(max_length=20, choices=STATUS_CATEGORY_CHOICES, default='upcoming')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', '-created_at']
        verbose_name = 'Task'
        verbose_name_plural = 'Tasks'

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        if self.is_completed or not self.due_date:
            return False
        return self.due_date < timezone.now().date()

    @property
    def date_range_display(self):
        """Generates friendly date range string like 'Sep 25 - Today' or 'Today'."""
        today = timezone.now().date()
        if not self.due_date:
            return "No due date"

        due_str = "Today" if self.due_date == today else self.due_date.strftime("%b %d")

        if self.start_date:
            start_str = "Today" if self.start_date == today else self.start_date.strftime("%b %d")
            return f"{start_str} - {due_str}"
        return due_str

    def save(self, *args, **kwargs):
        # Automatically update status_category based on completion and date
        if self.is_completed:
            self.status_category = 'completed'
            if not self.completed_at:
                self.completed_at = timezone.now()
        else:
            self.completed_at = None
            if self.due_date and self.due_date < timezone.now().date():
                self.status_category = 'overdue'
            else:
                self.status_category = 'upcoming'
        super().save(*args, **kwargs)


class DashboardWidget(models.Model):
    """
    User configurable dashboard widgets ('My tasks', 'Projects', etc.).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dashboard_widgets')
    widget_type = models.CharField(max_length=50)  # 'my_tasks', 'projects', 'stats'
    position = models.PositiveIntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['position']
        unique_together = ('user', 'widget_type')

    def __str__(self):
        return f"{self.user.username} - {self.widget_type}"


class Portfolio(models.Model):
    """
    Portfolios group multiple projects for tracking high-level progress.
    """
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolios')
    projects = models.ManyToManyField(Project, related_name='portfolios', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
