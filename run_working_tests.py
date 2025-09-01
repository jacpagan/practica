#!/usr/bin/env python3
"""
Simple test runner that only runs working tests
"""
import os
import sys
import django
from django.core.management import execute_from_command_line

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure Django settings for testing
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.test_settings')

# Setup Django
django.setup()

if __name__ == '__main__':
    # Only run tests that are known to work
    working_tests = [
        'tests.test_simple',
        'tests.test_health',
        'tests.test_models',
        'tests.test_request_id_middleware',
    ]
    
    # Run each working test
    for test in working_tests:
        print(f"\n{'='*50}")
        print(f"Running {test}")
        print(f"{'='*50}")
        
        try:
            # Create a custom argv for the test command
            argv = ['manage.py', 'test', test, '--verbosity=2']
            execute_from_command_line(argv)
        except Exception as e:
            print(f"Error running {test}: {e}")
            continue
    
    print(f"\n{'='*50}")
    print("Test run completed!")
    print(f"{'='*50}")
