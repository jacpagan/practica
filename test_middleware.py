#!/usr/bin/env python3
"""
Test script to verify mobile optimization middleware configuration
"""

import os
import sys
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings_heroku')
django.setup()

from django.conf import settings

def test_middleware_configuration():
    """Test the middleware configuration."""
    print("🔍 Testing Mobile Optimization Middleware Configuration")
    print("=" * 60)
    
    # Check if mobile optimization is enabled
    print(f"MOBILE_OPTIMIZATION_ENABLED: {getattr(settings, 'MOBILE_OPTIMIZATION_ENABLED', 'Not set')}")
    print(f"PWA_ENABLED: {getattr(settings, 'PWA_ENABLED', 'Not set')}")
    print(f"MOBILE_CAMERA_QUALITY: {getattr(settings, 'MOBILE_CAMERA_QUALITY', 'Not set')}")
    print(f"MOBILE_MAX_RECORDING_TIME: {getattr(settings, 'MOBILE_MAX_RECORDING_TIME', 'Not set')}")
    
    # Check middleware configuration
    print(f"\n📋 Middleware Configuration:")
    print(f"Total middleware: {len(settings.MIDDLEWARE)}")
    
    mobile_middleware = []
    for i, middleware in enumerate(settings.MIDDLEWARE):
        print(f"  {i+1}. {middleware}")
        if 'MobileOptimizationMiddleware' in middleware:
            mobile_middleware.append(middleware)
    
    if mobile_middleware:
        print(f"\n✅ Mobile Optimization Middleware found: {len(mobile_middleware)} instance(s)")
        for mw in mobile_middleware:
            print(f"   - {mw}")
    else:
        print(f"\n❌ Mobile Optimization Middleware NOT found!")
    
    # Check for other important middleware
    important_middleware = [
        'CorsMiddleware',
        'SecurityMiddleware', 
        'WhiteNoiseMiddleware',
        'SessionMiddleware',
        'CommonMiddleware'
    ]
    
    print(f"\n🔧 Important Middleware Check:")
    for mw in important_middleware:
        found = any(mw in str(m) for m in settings.MIDDLEWARE)
        status = "✅" if found else "❌"
        print(f"   {status} {mw}")
    
    # Check static files configuration
    print(f"\n📁 Static Files Configuration:")
    print(f"STATIC_URL: {getattr(settings, 'STATIC_URL', 'Not set')}")
    print(f"STATIC_ROOT: {getattr(settings, 'STATIC_ROOT', 'Not set')}")
    print(f"STATICFILES_STORAGE: {getattr(settings, 'STATICFILES_STORAGE', 'Not set')}")
    
    # Check if WhiteNoise is configured
    if 'whitenoise.middleware.WhiteNoiseMiddleware' in str(settings.MIDDLEWARE):
        print("✅ WhiteNoise middleware is configured")
    else:
        print("❌ WhiteNoise middleware is NOT configured")
    
    print("\n" + "=" * 60)
    
    if mobile_middleware:
        print("🎯 Mobile Optimization Middleware is properly configured!")
        return True
    else:
        print("❌ Mobile Optimization Middleware is NOT configured!")
        return False

if __name__ == "__main__":
    success = test_middleware_configuration()
    sys.exit(0 if success else 1)
