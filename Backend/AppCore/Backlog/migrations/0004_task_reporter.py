from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("backlog", "0003_task_due_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="reporter",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
