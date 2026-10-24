from django.db import models


class Goal(models.Model):

    STATUS_CHOICES = [
        ('on_track', 'On track'),
        ('at_risk', 'At risk'),
        ('off_track', 'Off track'),
    ]

    name = models.CharField(max_length=255)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='on_track'
    )

    progress = models.PositiveIntegerField(default=0)

    team = models.CharField(max_length=100)

    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
