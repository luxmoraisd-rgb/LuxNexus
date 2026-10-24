from rest_framework import serializers

from jira_clone.models import ResourcingProject


class CapacityProjectSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    allocations = serializers.SerializerMethodField()

    class Meta:
        model = ResourcingProject
        fields = ["id", "name", "start_date", "end_date", "allocations"]

    def get_allocations(self, project):
        allocations = project.allocations.select_related("user").order_by("month", "user__username")
        return [
            {
                "id": str(allocation.id),
                "user": {
                    "id": str(allocation.user.id),
                    "username": allocation.user.username,
                    "email": allocation.user.email,
                },
                "month": allocation.month,
                "hours": allocation.hours,
            }
            for allocation in allocations
        ]
