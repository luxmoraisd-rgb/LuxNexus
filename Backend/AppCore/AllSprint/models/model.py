from django.db import models


class Sprint(models.Model):
    name = models.CharField(max_length=255)

    start_date = models.DateField()

    end_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=[
            ('PLANNED', 'Planned'),
            ('ACTIVE', 'Active'),
        ],
        default='PLANNED'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'allsprint'

    def __str__(self):
        return self.name


class Task(models.Model):
    sprint = models.ForeignKey(
        Sprint,
        on_delete=models.CASCADE,
        related_name='tasks'
    )

    # Store Sprint name along with the Task
    sprint_name = models.CharField(
        max_length=255,
        blank=True
    )

    title = models.CharField(max_length=255)

    owner = models.CharField(
        max_length=255,
        blank=True
    )

    status = models.CharField(
        max_length=100,
        choices=[
            ('READY_TO_START', 'Ready to start'),
            ('IN_PROGRESS', 'In Progress'),
            ('IN_REVIEW', 'In Review'),
            ('DONE', 'Done'),
        ]
    )

    task_type = models.CharField(
        max_length=20,
        choices=[
            ('FRONTEND', 'Frontend'),
            ('BACKEND', 'Backend'),
            ('FEATURE', 'Feature'),
            ('BUG', 'Bug'),
            ('QUALITY', 'Quality'),
        ]
    )

    estimated_sp = models.PositiveIntegerField(
        default=0
    )

    task_id = models.CharField(
        max_length=100,
        unique=True
    )

    epic = models.CharField(
        max_length=255,
        choices=[
            ('Infrastructure', 'Infrastructure'),
            ('Database Maintenance', 'Database Maintenance'),
            ('Automation - Website Services', 'Automation - Website Services'),
            ('Operations', 'Operations'),
        ],
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.sprint_id:
            self.sprint_name = self.sprint.name

        super().save(*args, **kwargs)

    class Meta:
        app_label = 'allsprint'

    def __str__(self):
        return self.title