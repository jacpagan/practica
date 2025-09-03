from django.core.management.base import BaseCommand
from accounts.models import Role


class Command(BaseCommand):
    help = 'Seed roles for the application'

    def handle(self, *args, **options):
        roles = ['student', 'instructor']
        
        for role_name in roles:
            role, created = Role.objects.get_or_create(name=role_name)
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully created role: {role_name}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Role already exists: {role_name}')
                )
