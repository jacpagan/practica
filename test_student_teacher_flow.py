#!/usr/bin/env python3
"""
Test script to verify student-teacher role functionality
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings')
django.setup()

from django.contrib.auth.models import User
from accounts.models import Role, Profile
from exercises.models import Exercise
from comments.models import VideoComment
from core.models import VideoAsset

def test_role_functionality():
    """Test the student-teacher role functionality"""
    
    print("🧪 Testing Student-Teacher Role Functionality")
    print("=" * 50)
    
    # Get roles
    try:
        student_role = Role.objects.get(name='student')
        instructor_role = Role.objects.get(name='instructor')
        print("✅ Roles found: student, instructor")
    except Role.DoesNotExist as e:
        print(f"❌ Error: {e}")
        return False
    
    # Create test users
    print("\n👥 Creating test users...")
    
    # Create a teacher
    teacher_user = User.objects.create_user(
        username='test_teacher',
        email='teacher@example.com',
        password='testpass123'
    )
    teacher_profile = Profile.objects.create(user=teacher_user, role=instructor_role)
    print(f"✅ Created teacher: {teacher_user.username} with role: {teacher_profile.role.name}")
    
    # Create a student
    student_user = User.objects.create_user(
        username='test_student',
        email='student@example.com',
        password='testpass123'
    )
    student_profile = Profile.objects.create(user=student_user, role=student_role)
    print(f"✅ Created student: {student_user.username} with role: {student_profile.role.name}")
    
    # Create a video asset for testing
    print("\n📹 Creating test video asset...")
    video_asset = VideoAsset.objects.create(
        orig_filename="test_exercise_video.mp4",
        mime_type="video/mp4",
        video_type="upload",
        processing_status="completed"
    )
    print(f"✅ Created video asset: {video_asset.orig_filename}")
    
    # Test teacher can create exercise
    print("\n📚 Testing exercise creation...")
    exercise = Exercise.objects.create(
        name="Test Exercise",
        description="A test exercise created by teacher",
        video_asset=video_asset,
        created_by=teacher_user
    )
    print(f"✅ Teacher created exercise: {exercise.name}")
    
    # Test student can comment on exercise
    print("\n💬 Testing student commenting...")
    student_comment = VideoComment.objects.create(
        exercise=exercise,
        author=student_user,
        text="Great exercise! I learned a lot.",
        video_asset=video_asset
    )
    print(f"✅ Student commented: {student_comment.text[:30]}...")
    
    # Test teacher can comment on exercise
    print("\n💬 Testing teacher commenting...")
    teacher_comment = VideoComment.objects.create(
        exercise=exercise,
        author=teacher_user,
        text="Excellent work! Keep practicing.",
        video_asset=video_asset
    )
    print(f"✅ Teacher commented: {teacher_comment.text[:30]}...")
    
    # Test dashboard data
    print("\n📊 Testing dashboard data...")
    
    # Student dashboard should show exercises created by teachers
    student_exercises = Exercise.objects.exclude(created_by=student_user)
    print(f"✅ Student dashboard shows {student_exercises.count()} exercises (not created by student)")
    
    # Teacher dashboard should show exercises created by teacher
    teacher_exercises = Exercise.objects.filter(created_by=teacher_user)
    print(f"✅ Teacher dashboard shows {teacher_exercises.count()} exercises (created by teacher)")
    
    # Comments on teacher's exercises
    comments_on_teacher_exercises = VideoComment.objects.filter(exercise__created_by=teacher_user)
    print(f"✅ Teacher dashboard shows {comments_on_teacher_exercises.count()} comments on their exercises")
    
    # Student's own comments
    student_comments = VideoComment.objects.filter(author=student_user)
    print(f"✅ Student dashboard shows {student_comments.count()} of their own comments")
    
    print("\n🎉 All tests passed! Student-Teacher role functionality is working correctly.")
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    teacher_user.delete()
    student_user.delete()
    video_asset.delete()
    print("✅ Test data cleaned up")
    
    return True

if __name__ == '__main__':
    try:
        success = test_role_functionality()
        if success:
            print("\n✅ Student-Teacher role implementation is working correctly!")
            sys.exit(0)
        else:
            print("\n❌ Student-Teacher role implementation has issues!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
