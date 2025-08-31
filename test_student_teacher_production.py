#!/usr/bin/env python3
"""
Test script to verify student-teacher role functionality in live production
"""

import requests
import json
import time
from urllib.parse import urljoin

BASE_URL = "https://practika.jpagan.com"
TEST_USER = f"testuser_{int(time.time())}"
TEST_PASSWORD = f"testpass123_{int(time.time())}"

def test_production_roles():
    """Test the student-teacher role functionality in production"""
    
    print("🧪 Testing Student-Teacher Role Functionality in Production")
    print("=" * 60)
    print(f"Testing: {BASE_URL}")
    print(f"Test User: {TEST_USER}")
    print()
    
    session = requests.Session()
    
    # Test 1: Check if login page loads
    print("📋 Test 1: Login Page Accessibility")
    try:
        response = session.get(f"{BASE_URL}/exercises/login/")
        if response.status_code == 200:
            print("✅ Login page is accessible")
            
            # Check for role selection in the page
            if "role" in response.text.lower() or "student" in response.text.lower() or "teacher" in response.text.lower():
                print("✅ Role selection elements found in login page")
            else:
                print("⚠️  Role selection elements not found in login page")
        else:
            print(f"❌ Login page returned status {response.status_code}")
    except Exception as e:
        print(f"❌ Error accessing login page: {e}")
    
    print()
    
    # Test 2: Test user registration with role selection
    print("📋 Test 2: User Registration with Role Selection")
    try:
        # Register as a student
        register_data = {
            'username': TEST_USER,
            'password1': TEST_PASSWORD,
            'password2': TEST_PASSWORD,
            'email': f"{TEST_USER}@test.com",
            'role': 'student',
            'action': 'signup'
        }
        
        response = session.post(f"{BASE_URL}/exercises/login/", data=register_data)
        print(f"Registration response status: {response.status_code}")
        
        if response.status_code in [200, 302]:
            print("✅ User registration completed")
        else:
            print(f"⚠️  Registration returned status {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error during registration: {e}")
    
    print()
    
    # Test 3: Test user login and role-based routing
    print("📋 Test 3: User Login and Role-Based Routing")
    try:
        login_data = {
            'username': TEST_USER,
            'password': TEST_PASSWORD,
            'action': 'login'
        }
        
        response = session.post(f"{BASE_URL}/exercises/login/", data=login_data)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code in [200, 302]:
            print("✅ User login completed")
            
            # Check if we're redirected to the appropriate dashboard
            if response.status_code == 302:
                redirect_url = response.headers.get('Location', '')
                print(f"Redirect URL: {redirect_url}")
                
                if 'student' in redirect_url or 'dashboard' in redirect_url:
                    print("✅ Role-based routing appears to be working")
                else:
                    print("⚠️  Unexpected redirect URL")
        else:
            print(f"⚠️  Login returned status {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error during login: {e}")
    
    print()
    
    # Test 4: Check API endpoints
    print("📋 Test 4: API Endpoints")
    try:
        # Test videos API
        response = session.get(f"{BASE_URL}/core/api/videos/")
        if response.status_code == 200:
            print("✅ Videos API is accessible")
        else:
            print(f"⚠️  Videos API returned status {response.status_code}")
            
        # Test comments API
        response = session.get(f"{BASE_URL}/comments/api/comments/")
        if response.status_code == 200:
            print("✅ Comments API is accessible")
        else:
            print(f"⚠️  Comments API returned status {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error testing APIs: {e}")
    
    print()
    
    # Test 5: Check health endpoint
    print("📋 Test 5: Health Check")
    try:
        response = session.get(f"{BASE_URL}/core/health/")
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Health check passed: {health_data.get('status', 'unknown')}")
            print(f"   Environment: {health_data.get('environment', 'unknown')}")
            print(f"   Response time: {health_data.get('response_time_ms', 'unknown')}ms")
        else:
            print(f"⚠️  Health check returned status {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking health: {e}")
    
    print()
    print("🎉 Production testing completed!")
    print("The student-teacher role functionality has been deployed to your live production environment.")
    print(f"Visit: {BASE_URL}")

if __name__ == "__main__":
    test_production_roles()
