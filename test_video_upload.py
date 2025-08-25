#!/usr/bin/env python3
"""
Test script for video upload functionality
This script tests the video upload endpoint and verifies S3 integration
"""

import os
import sys
import django
import requests
from pathlib import Path

# Add the project directory to Python path
sys.path.append(str(Path(__file__).parent))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings')
django.setup()

def test_video_upload():
    """Test the video upload functionality"""
    
    # Test data
    test_video_path = "test_media/test_video.mp4"
    upload_url = "http://localhost:8000/core/api/upload-video/"
    
    # Check if test video exists
    if not os.path.exists(test_video_path):
        print(f"❌ Test video not found: {test_video_path}")
        print("Please create a test video file or update the path")
        return False
    
    print(f"📹 Testing video upload with: {test_video_path}")
    
    try:
        # Prepare the upload
        with open(test_video_path, 'rb') as video_file:
            files = {'video': video_file}
            
            # Make the upload request
            response = requests.post(upload_url, files=files)
            
            if response.status_code == 201:
                result = response.json()
                print("✅ Video upload successful!")
                print(f"   Video ID: {result.get('video_id')}")
                print(f"   Filename: {result.get('filename')}")
                print(f"   Size: {result.get('size_bytes')} bytes")
                print(f"   MIME Type: {result.get('mime_type')}")
                print(f"   URL: {result.get('url')}")
                print(f"   Storage Path: {result.get('storage_path')}")
                return True
            else:
                print(f"❌ Upload failed with status {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Is the Django server running?")
        print("   Start with: python manage.py runserver")
        return False
    except Exception as e:
        print(f"❌ Error during upload: {e}")
        return False

def test_video_listing():
    """Test the video listing functionality"""
    
    list_url = "http://localhost:8000/core/api/videos/"
    
    try:
        response = requests.get(list_url)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Video listing successful!")
            print(f"   Total videos: {result.get('total_count', 0)}")
            
            videos = result.get('videos', [])
            for video in videos[:3]:  # Show first 3 videos
                print(f"   - {video.get('filename')} ({video.get('size_mb')}MB)")
            return True
        else:
            print(f"❌ Video listing failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error during video listing: {e}")
        return False

def check_environment():
    """Check if the environment is properly configured"""
    
    print("🔍 Checking environment configuration...")
    
    # Check Django settings
    try:
        from django.conf import settings
        print(f"   Django environment: {getattr(settings, 'ENVIRONMENT', 'unknown')}")
        print(f"   Debug mode: {settings.DEBUG}")
        print(f"   Media root: {getattr(settings, 'MEDIA_ROOT', 'not set')}")
        
        # Check S3 configuration
        aws_bucket = os.environ.get('AWS_STORAGE_BUCKET_NAME')
        if aws_bucket:
            print(f"   S3 bucket: {aws_bucket}")
            print(f"   AWS region: {os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')}")
        else:
            print("   S3 bucket: not configured (will use local storage)")
            
        # Check database
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            print("   Database: connected")
            
    except Exception as e:
        print(f"   ❌ Environment check failed: {e}")
        return False
    
    return True

def main():
    """Main test function"""
    
    print("🚀 Testing Practika Video Upload System")
    print("=" * 50)
    
    # Check environment
    if not check_environment():
        print("\n❌ Environment check failed. Please fix configuration issues.")
        return
    
    print("\n" + "=" * 50)
    
    # Test video listing first
    print("\n📋 Testing video listing...")
    test_video_listing()
    
    # Test video upload
    print("\n📤 Testing video upload...")
    test_video_upload()
    
    print("\n" + "=" * 50)
    print("🎯 Test completed!")
    print("\nTo test manually:")
    print("1. Start Django server: python manage.py runserver")
    print("2. Upload video: POST to /core/api/upload-video/")
    print("3. List videos: GET /core/api/videos/")
    print("4. Delete video: DELETE /core/api/videos/<id>/delete/")

if __name__ == "__main__":
    main()
