"""
Base test class for Practika tests
"""
from django.test import TestCase
from django.core.management import call_command
from django.db import connection


class PractikaTestCase(TestCase):
    """Base test case for Practika tests with proper database setup"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test class with proper database initialization"""
        super().setUpClass()
        
        # Ensure migrations are applied
        try:
            call_command('migrate', verbosity=0)
        except Exception:
            pass
        
        # Ensure roles are seeded
        try:
            call_command('seed_roles', verbosity=0)
        except Exception:
            pass
    
    def setUp(self):
        """Set up each test method"""
        super().setUp()
        
        # Ensure roles exist for each test
        try:
            from accounts.models import Role
            Role.objects.get_or_create(name='student')
            Role.objects.get_or_create(name='instructor')
        except Exception:
            pass
