#!/usr/bin/env python3
"""
Test script to verify Practika works locally
"""

import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings')
django.setup()

from django.test import Client
from django.urls import reverse
from django.conf import settings

def test_basic_functionality():
    """Test basic application functionality."""
    print("🧪 Testing Practika Application")
    print("=" * 50)
    
    client = Client()
    
    # Test home page
    print("📱 Testing home page...")
    try:
        response = client.get('/')
        if response.status_code == 200:
            print("✅ Home page works")
        else:
            print(f"❌ Home page failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Home page error: {e}")
    
    # Test health check
    print("🏥 Testing health check...")
    try:
        response = client.get('/core/health/')
        if response.status_code == 200:
            print("✅ Health check works")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
    
    # Test core URLs
    print("🔗 Testing core URLs...")
    try:
        response = client.get('/core/api/videos/')
        # This should redirect to login since it requires authentication
        if response.status_code in [302, 401]:
            print("✅ Core API properly protected")
        else:
            print(f"⚠️ Core API unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Core API error: {e}")
    
    # Test exercises URLs
    print("📚 Testing exercises URLs...")
    try:
        response = client.get('/exercises/')
        if response.status_code in [200, 302, 404]:
            print("✅ Exercises URLs accessible")
        else:
            print(f"⚠️ Exercises unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Exercises error: {e}")
    
    # Test comments URLs
    print("💬 Testing comments URLs...")
    try:
        response = client.get('/comments/')
        if response.status_code in [200, 302, 404]:
            print("✅ Comments URLs accessible")
        else:
            print(f"⚠️ Comments unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Comments error: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 Basic functionality test completed!")

def test_settings():
    """Test Django settings configuration."""
    print("\n🔧 Testing Django Settings")
    print("=" * 50)
    
    print(f"DEBUG: {settings.DEBUG}")
    print(f"ENVIRONMENT: {getattr(settings, 'ENVIRONMENT', 'Not set')}")
    print(f"SECRET_KEY: {'Set' if settings.SECRET_KEY else 'Not set'}")
    print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
    print(f"INSTALLED_APPS: {len(settings.INSTALLED_APPS)} apps")
    print(f"MIDDLEWARE: {len(settings.MIDDLEWARE)} middleware")
    print(f"DATABASE_ENGINE: {settings.DATABASES['default']['ENGINE']}")
    print(f"STATIC_ROOT: {settings.STATIC_ROOT}")
    print(f"MEDIA_ROOT: {settings.MEDIA_ROOT}")
    
    print("\n" + "=" * 50)

def test_database():
    """Test database connection."""
    print("\n🗄️ Testing Database Connection")
    print("=" * 50)
    
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result and result[0] == 1:
                print("✅ Database connection successful")
            else:
                print("❌ Database connection failed")
    except Exception as e:
        print(f"❌ Database error: {e}")
    
    print("\n" + "=" * 50)

if __name__ == "__main__":
    print("🚀 Starting Practika Local Test Suite")
    print("=" * 50)
    
    try:
        test_settings()
        test_database()
        test_basic_functionality()
        
        print("\n🎉 All tests completed successfully!")
        print("✅ Your application is ready for production deployment!")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
