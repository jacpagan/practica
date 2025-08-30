#!/usr/bin/env python3
"""
Script to run database migration for YouTube support
"""
import os
import sys
import django

# Add the project directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings_aws')

# Setup Django
django.setup()

from django.core.management import execute_from_command_line

if __name__ == '__main__':
    print("Running database migration for YouTube support...")
    execute_from_command_line(['manage.py', 'migrate'])
    print("Migration completed!")
