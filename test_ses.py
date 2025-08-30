#!/usr/bin/env python3
"""
Simple script to test Amazon SES integration
Run this locally to verify SES is working
"""

import os
import sys
import django

# Add the project directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings_production')

# Setup Django
django.setup()

from django.core.mail import send_mail
from django.conf import settings

def test_ses():
    """Test Amazon SES email sending"""
    print("🧪 Testing Amazon SES Integration...")
    print(f"📧 Email Backend: {settings.EMAIL_BACKEND}")
    print(f"🔑 AWS Access Key: {'✅ Set' if settings.AWS_ACCESS_KEY_ID else '❌ Not set'}")
    print(f"🔐 AWS Secret Key: {'✅ Set' if settings.AWS_SECRET_ACCESS_KEY else '❌ Not set'}")
    print(f"🌍 AWS Region: {settings.AWS_S3_REGION_NAME}")
    print(f"📬 From Email: {settings.DEFAULT_FROM_EMAIL}")
    print()
    
    # Test email details
    to_email = "test@example.com"  # Change this to your email
    subject = "🧪 SES Test from Practika"
    message = """
    This is a test email to verify Amazon SES integration.
    
    If you receive this, SES is working perfectly!
    
    🎉 Your email system is ready for production.
    """
    
    print(f"📤 Sending test email to: {to_email}")
    print(f"📝 Subject: {subject}")
    print()
    
    try:
        # Send the email
        result = send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        
        if result:
            print("✅ SUCCESS! Email sent successfully!")
            print(f"📊 Result: {result} emails sent")
            print()
            print("🎯 Next steps:")
            print("1. Check your email inbox")
            print("2. If you don't receive it, check spam folder")
            print("3. Verify your email is verified in AWS SES")
            print("4. Check IAM permissions for SES")
        else:
            print("⚠️ Email was not sent (result: 0)")
            
    except Exception as e:
        print(f"❌ FAILED to send email: {e}")
        print()
        print("🔍 Common issues and solutions:")
        print("1. Email not verified in SES - Go to AWS SES console and verify")
        print("2. IAM permissions missing - Add AmazonSESFullAccess policy")
        print("3. SES in sandbox mode - Request production access")
        print("4. Region mismatch - Ensure SES and S3 regions match")

if __name__ == "__main__":
    test_ses()
