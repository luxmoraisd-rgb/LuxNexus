from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activesprint", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="sprint",
            name="project_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="task",
            name="project_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=255),
        ),
    ]
