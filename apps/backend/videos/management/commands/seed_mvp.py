from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from videos.models import Comment, Profile, ReviewFeedback, ReviewLink, Session


class Command(BaseCommand):
    help = 'Seed demo users, sessions, comments, and review feedback for MVP.'

    def handle(self, *args, **options):
        student, _ = User.objects.get_or_create(
            email='student@practica.local',
            defaults={'username': 'student_demo'},
        )
        student.set_password('student123')
        student.save()
        Profile.objects.update_or_create(
            user=student,
            defaults={'display_name': 'Demo Student', 'role': Profile.ROLE_STUDENT},
        )

        coach, _ = User.objects.get_or_create(
            email='coach@practica.local',
            defaults={'username': 'coach_demo'},
        )
        coach.set_password('coach123')
        coach.save()
        Profile.objects.update_or_create(
            user=coach,
            defaults={'display_name': 'Demo Coach', 'role': Profile.ROLE_COACH},
        )

        admin, _ = User.objects.get_or_create(
            email='admin@practica.local',
            defaults={'username': 'admin_demo', 'is_staff': True, 'is_superuser': True},
        )
        admin.set_password('admin123')
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()
        Profile.objects.update_or_create(
            user=admin,
            defaults={'display_name': 'Demo Admin', 'role': Profile.ROLE_ADMIN},
        )

        session, _ = Session.objects.get_or_create(
            user=student,
            title='Demo Rudiments Session',
            defaults={
                'description': 'Single-stroke roll + accent control',
                'video_file': 'sessions/demo/student-demo.mp4',
                'status': Session.STATUS_READY,
                'processing_status': Session.STATUS_READY,
                'duration_seconds': 900,
                'recorded_at': timezone.now(),
                'playback_mp4_url': 'sessions/demo/student-demo.mp4',
                'source_video_object_key': 'sessions/demo/student-demo.mp4',
            },
        )

        Comment.objects.get_or_create(
            session=session,
            user=coach,
            timestamp_seconds=75,
            text='Relax shoulders and keep wrists loose through this transition.',
            defaults={'legacy_text_only': True},
        )
        Comment.objects.get_or_create(
            session=session,
            user=coach,
            timestamp_seconds=240,
            text='Great tempo consistency here.',
            defaults={'legacy_text_only': True},
        )

        review_link, _ = ReviewLink.objects.get_or_create(
            session=session,
            token='demo-review-link-token',
            defaults={
                'created_by': student,
                'expires_at': timezone.now() + timedelta(days=30),
                'is_active': True,
                'allow_comments': True,
            },
        )
        ReviewFeedback.objects.get_or_create(
            review_link=review_link,
            session=session,
            name='External Reviewer',
            text='Love the control at 4:00.',
            defaults={'timestamp_seconds': 240},
        )

        self.stdout.write(self.style.SUCCESS('Seeded demo accounts and MVP sample data.'))
