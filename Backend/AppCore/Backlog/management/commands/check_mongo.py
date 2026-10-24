"""
Management command to check MongoDB connection status and perform a test query.
"""
from django.core.management.base import BaseCommand, CommandError
from ...db import check_mongo_connection, sync_django_models_to_mongo


class Command(BaseCommand):
    help = "Checks MongoDB connection health and syncs collections"

    def add_arguments(self, parser):
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Synchronize Django models into MongoDB collections',
        )

    def handle(self, *args, **options):
        self.stdout.write("Testing MongoDB database connection...")
        result = check_mongo_connection()
        
        if not result.get("ok"):
            self.stderr.write(self.style.ERROR("[FAIL] Failed to connect to MongoDB!"))
            raise CommandError(
                f"{result.get('error', 'Unknown MongoDB connection error')} "
                f"(host: {result.get('host')})"
            )

        self.stdout.write(self.style.SUCCESS("[OK] MongoDB Connected Successfully!"))
        self.stdout.write(f"  - Host:        {result.get('host')}")
        self.stdout.write(f"  - Database:    {result.get('database')}")
        self.stdout.write(f"  - Version:     {result.get('version')}")
        self.stdout.write(f"  - Ping:        {result.get('latency_ms')} ms")
        self.stdout.write(f"  - Collections: {result.get('collections')}")

        if options['sync']:
            sync_res = sync_django_models_to_mongo()
            self.stdout.write(self.style.SUCCESS("[OK] Data Synchronized with MongoDB:"))
            self.stdout.write(f"  - Boards:   {sync_res.get('boards_synced')}")
            self.stdout.write(f"  - Sprints:  {sync_res.get('sprints_synced')}")
            self.stdout.write(f"  - Tasks:    {sync_res.get('tasks_synced')}")
            self.stdout.write(f"  - Columns:  {sync_res.get('columns_synced')}")
            self.stdout.write(f"  - Views:    {sync_res.get('views_synced')}")
