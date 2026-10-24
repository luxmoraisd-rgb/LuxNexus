from rest_framework import serializers

from ..models import Sprint, Task


class SprintSerializer(serializers.ModelSerializer):
    total_sp = serializers.SerializerMethodField()

    class Meta:
        model = Sprint
        fields = [
            'name',
            'start_date',
            'end_date',
            'status',
            'created_at',
            'total_sp',
        ]

    def get_total_sp(self, obj):
        return sum(
            task.estimated_sp
            for task in obj.tasks.all()
        )


class ObjectIdRelatedField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        return str(value.pk)


class TaskSerializer(serializers.ModelSerializer):
    sprint = ObjectIdRelatedField(
        queryset=Sprint.objects.all()
    )
    sprint_name = serializers.CharField(
    source='sprint.name',
    read_only=True
    )

    class Meta:
        model = Task
        fields = [
            'sprint',
            'sprint_name',
            'title',
            'owner',
            'status',
            'task_type',
            'estimated_sp',
            'task_id',
            'epic',
            'created_at',
        ]