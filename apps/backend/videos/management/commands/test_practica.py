"""
Django management command to test Practica functionality.
"""

from django.core.management.base import BaseCommand
from videos.models import ExerciseVideo, PracticeThread

class Command(BaseCommand):
    help = 'Test Practica Django app functionality'

    def handle(self, *args, **options):
        self.stdout.write("🎯 Testing Practica Django App...")
        
        # Test database connection
        try:
            video_count = ExerciseVideo.objects.count()
            thread_count = PracticeThread.objects.count()
            self.stdout.write(
                self.style.SUCCESS(f"✅ Database connection working!")
            )
            self.stdout.write(f"   Exercise Videos: {video_count}")
            self.stdout.write(f"   Practice Threads: {thread_count}")
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Database error: {e}")
            )
            return
        
        # Test model creation
        try:
            test_video = ExerciseVideo.objects.create(
                title="Test Drum Lesson",
                description="A test exercise video",
                tags="test, drum, lesson"
            )
            self.stdout.write(
                self.style.SUCCESS(f"✅ Model creation working!")
            )
            self.stdout.write(f"   Created: {test_video}")
            
            # Clean up test data
            test_video.delete()
            self.stdout.write("   Test data cleaned up")
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"❌ Model creation error: {e}")
            )
            return
        
        self.stdout.write(
            self.style.SUCCESS("🎉 Practica Django App is working perfectly!")
        )
        self.stdout.write("   ✅ Database connection")
        self.stdout.write("   ✅ Model operations")
        self.stdout.write("   ✅ Ready for your personal practice tracking!")
