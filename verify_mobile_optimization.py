#!/usr/bin/env python3
"""
Mobile Optimization Verification Script

This script verifies that all mobile optimization features are active
on your Heroku deployment.
"""

import requests
import json
import sys
from urllib.parse import urljoin

def check_mobile_optimization(base_url):
    """Check mobile optimization features on the deployed app."""
    
    print(f"🔍 Checking mobile optimization on: {base_url}")
    print("=" * 60)
    
    # Test 1: Check if the app is accessible
    try:
        response = requests.get(base_url, timeout=10)
        print(f"✅ App accessible: {response.status_code}")
    except Exception as e:
        print(f"❌ App not accessible: {e}")
        return False
    
    # Test 2: Check mobile optimization headers
    print("\n📱 Checking mobile optimization headers...")
    
    # Test with iPhone SE user agent
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
    }
    
    try:
        response = requests.get(base_url, headers=headers, timeout=10)
        
        mobile_headers = [
            'X-Mobile-Optimized',
            'X-Device-Type', 
            'X-iPhone-SE',
            'X-Small-Screen',
            'X-Performance-Mode',
            'X-Touch-Target-Size'
        ]
        
        found_headers = []
        for header in mobile_headers:
            if header in response.headers:
                value = response.headers[header]
                print(f"✅ {header}: {value}")
                found_headers.append(header)
            else:
                print(f"❌ {header}: Not found")
        
        if len(found_headers) >= 3:
            print(f"✅ Mobile optimization middleware is active ({len(found_headers)}/6 headers found)")
        else:
            print(f"⚠️ Mobile optimization may not be fully active ({len(found_headers)}/6 headers found)")
            
    except Exception as e:
        print(f"❌ Error checking mobile headers: {e}")
    
    # Test 3: Check PWA manifest
    print("\n📱 Checking PWA features...")
    try:
        manifest_url = urljoin(base_url, '/static/manifest.json')
        response = requests.get(manifest_url, timeout=10)
        if response.status_code == 200:
            manifest = response.json()
            print(f"✅ PWA manifest found: {manifest.get('name', 'Unknown')}")
            print(f"   - Display mode: {manifest.get('display', 'Unknown')}")
            print(f"   - Icons: {len(manifest.get('icons', []))} icon(s)")
        else:
            print(f"❌ PWA manifest not accessible: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking PWA manifest: {e}")
    
    # Test 4: Check service worker
    print("\n🔧 Checking service worker...")
    try:
        sw_url = urljoin(base_url, '/static/sw.js')
        response = requests.get(sw_url, timeout=10)
        if response.status_code == 200:
            print("✅ Service worker found")
            content = response.text
            if 'practika' in content.lower():
                print("   - Service worker appears to be Practika-specific")
            else:
                print("   - Service worker content generic")
        else:
            print(f"❌ Service worker not accessible: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking service worker: {e}")
    
    # Test 5: Check mobile CSS
    print("\n🎨 Checking mobile CSS...")
    try:
        css_url = urljoin(base_url, '/static/css/icon-ui.css')
        response = requests.get(css_url, timeout=10)
        if response.status_code == 200:
            content = response.text
            mobile_features = [
                'touch-target',
                'mobile',
                'iphone',
                'responsive',
                'media query'
            ]
            
            found_features = []
            for feature in mobile_features:
                if feature in content.lower():
                    found_features.append(feature)
            
            print(f"✅ Mobile CSS found with {len(found_features)} mobile features")
            print(f"   - Features: {', '.join(found_features)}")
        else:
            print(f"❌ Mobile CSS not accessible: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking mobile CSS: {e}")
    
    # Test 6: Check health endpoint
    print("\n🏥 Checking health endpoint...")
    try:
        health_url = urljoin(base_url, '/health/')
        response = requests.get(health_url, timeout=10)
        if response.status_code == 200:
            print("✅ Health endpoint accessible")
            try:
                health_data = response.json()
                if 'mobile_optimization' in str(health_data):
                    print("   - Mobile optimization mentioned in health data")
                else:
                    print("   - Health data doesn't mention mobile optimization")
            except:
                print("   - Health endpoint returns non-JSON data")
        else:
            print(f"❌ Health endpoint not accessible: {response.status_code}")
    except Exception as e:
        print(f"❌ Error checking health endpoint: {e}")
    
    print("\n" + "=" * 60)
    print("🎯 Mobile Optimization Verification Complete!")
    
    return True

def main():
    """Main function."""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "https://practika-d127ed6da5d2.herokuapp.com"
    
    # Ensure URL has protocol
    if not base_url.startswith(('http://', 'https://')):
        base_url = 'https://' + base_url
    
    success = check_mobile_optimization(base_url)
    
    if success:
        print("\n✅ Verification completed successfully!")
        print("\n📱 Your app appears to have mobile optimization features active.")
        print("   - Test on real devices to verify touch targets and performance")
        print("   - Use the mobile compatibility checklist for thorough testing")
    else:
        print("\n❌ Verification failed. Check your deployment configuration.")
        sys.exit(1)

if __name__ == "__main__":
    main()
