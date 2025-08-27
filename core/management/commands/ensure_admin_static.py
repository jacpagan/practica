from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.staticfiles.finders import AppDirectoriesFinder
import os
import shutil
import django.contrib.admin


class Command(BaseCommand):
    help = 'Ensure admin static files are properly collected'

    def handle(self, *args, **options):
        self.stdout.write('Ensuring admin static files are collected...')
        
        # Get the admin static source directory
        admin_static_source = os.path.join(
            os.path.dirname(django.contrib.admin.__file__), 
            'static', 
            'admin'
        )
        
        # Get the target directory
        admin_static_target = os.path.join(settings.STATIC_ROOT, 'admin')
        
        self.stdout.write(f'Source: {admin_static_source}')
        self.stdout.write(f'Target: {admin_static_target}')
        
        if not os.path.exists(admin_static_source):
            self.stdout.write(self.style.ERROR(f'Admin static source not found: {admin_static_source}'))
            return
        
        # Ensure target directory exists
        os.makedirs(admin_static_target, exist_ok=True)
        
        # Copy admin static files
        try:
            if os.path.exists(admin_static_target):
                shutil.rmtree(admin_static_target)
            
            shutil.copytree(admin_static_source, admin_static_target)
            
            # Verify the copy
            if os.path.exists(admin_static_target):
                css_file = os.path.join(admin_static_target, 'css', 'base.css')
                if os.path.exists(css_file):
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Admin static files copied successfully. CSS file size: {os.path.getsize(css_file)} bytes'
                        )
                    )
                else:
                    self.stdout.write(self.style.ERROR('CSS file not found after copy'))
            else:
                self.stdout.write(self.style.ERROR('Target directory not created'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error copying admin static files: {e}'))
