#!/usr/bin/env python
import os
import django
import shutil

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings_production')
django.setup()

from django.conf import settings

print("=== Django Static Files Debug ===")
print(f"Django version: {django.get_version()}")
print(f"Static root: {settings.STATIC_ROOT}")
print(f"Static files dirs: {settings.STATICFILES_DIRS}")
print(f"Static files finders: {settings.STATICFILES_FINDERS}")
print(f"Static URL: {settings.STATIC_URL}")

# Check if staticfiles directory exists
if os.path.exists('/app/staticfiles'):
    print(f"Staticfiles directory exists: {os.path.exists('/app/staticfiles')}")
    print(f"Staticfiles contents: {os.listdir('/app/staticfiles')}")
    
    # Check for admin directory
    admin_dir = '/app/staticfiles/admin'
    if os.path.exists(admin_dir):
        print(f"Admin directory exists: {os.path.exists(admin_dir)}")
        print(f"Admin directory contents: {os.listdir(admin_dir)}")
    else:
        print("Admin directory does not exist")
else:
    print("Staticfiles directory does not exist")

# Check Django admin app location
import django.contrib.admin
admin_static_path = os.path.join(os.path.dirname(django.contrib.admin.__file__), 'static', 'admin')
print(f"Django admin static path: {admin_static_path}")
print(f"Django admin static exists: {os.path.exists(admin_static_path)}")
if os.path.exists(admin_static_path):
    print(f"Django admin static contents: {os.listdir(admin_static_path)}")

# Try to manually copy admin static files
print("\n=== Attempting Manual Copy ===")
try:
    # Remove existing staticfiles directory
    if os.path.exists('/app/staticfiles'):
        shutil.rmtree('/app/staticfiles')
    
    # Recreate staticfiles directory
    os.makedirs('/app/staticfiles', exist_ok=True)
    
    # Manually copy admin static files
    target_admin_dir = '/app/staticfiles/admin'
    shutil.copytree(admin_static_path, target_admin_dir)
    
    print(f"Manual copy successful: {os.path.exists(target_admin_dir)}")
    if os.path.exists(target_admin_dir):
        print(f"Admin directory contents after copy: {os.listdir(target_admin_dir)}")
        
except Exception as e:
    print(f"Manual copy failed: {e}")
