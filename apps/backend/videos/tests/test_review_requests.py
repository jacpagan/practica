from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import FeedbackTemplate, Profile, ReviewRequest, Session, SessionLastSeen, TeacherRosterMembership, VideoFeedback


class ReviewRequestApiTests(APITestCase):
    def setUp(self):
        self.student = User.objects.create_user(username='student-user', password='pass1234')
        self.teacher = User.objects.create_user(username='teacher-user', password='pass1234')
        self.outsider = User.objects.create_user(username='outsider-user', password='pass1234')
        Profile.objects.create(user=self.student, display_name='Student Musician')
        Profile.objects.create(user=self.teacher, display_name='Drum Teacher')
        Profile.objects.create(user=self.outsider, display_name='Random Reviewer')
        self.session = Session.objects.create(
            user=self.student,
            title='Groove Practice',
            description='Working on ghost notes',
            video_file='sessions/groove-practice.mp4',
            duration_seconds=180,
            processing_status=Session.STATUS_READY,
        )

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _video_file(self, name='feedback.mp4', content_type='video/mp4'):
        return SimpleUploadedFile(name, b'video-feedback-data', content_type=content_type)

    def _create_review_request(self):
        self._auth(self.student)
        response = self.client.post(
            '/api/review-requests/',
            {
                'session_id': self.session.id,
                'teacher_id': self.teacher.id,
                'instrument': 'drums',
                'student_level': 'intermediate',
                'goal': 'Improve ghost-note consistency',
                'exercise_or_song': 'Funky groove in 4/4',
                'notes': 'Focus on bars 5 through 8.',
                'requested_turnaround_hours': 24,
                'deadline': (timezone.now() + timedelta(days=2)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return ReviewRequest.objects.get(pk=response.data['id'])

    def test_student_can_create_review_request_with_link_and_roster_membership(self):
        review_request = self._create_review_request()

        self.assertEqual(review_request.student, self.student)
        self.assertEqual(review_request.teacher, self.teacher)
        self.assertEqual(review_request.status, ReviewRequest.STATUS_REQUESTED)
        self.assertEqual(review_request.instrument, 'drums')
        self.assertTrue(bool(review_request.review_link))
        self.assertTrue(
            TeacherRosterMembership.objects.filter(
                teacher=self.teacher,
                student=self.student,
                is_active=True,
            ).exists()
        )

    def test_teacher_inbox_lists_assigned_review_requests(self):
        review_request = self._create_review_request()

        self._auth(self.teacher)
        response = self.client.get('/api/teacher/inbox/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], review_request.id)
        self.assertEqual(response.data[0]['current_user_role'], 'teacher')

    def test_only_designated_teacher_can_reply_via_review_link(self):
        review_request = self._create_review_request()

        self._auth(self.outsider)
        response = self.client.post(
            f'/api/review/{review_request.review_link.token}/feedback/',
            {
                'text': 'Trying to review without permission.',
                'feedback_video': self._video_file(),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'review_request_forbidden')

    def test_designated_teacher_open_and_reply_updates_request_status(self):
        review_request = self._create_review_request()

        self._auth(self.teacher)
        open_response = self.client.get(f'/api/review/{review_request.review_link.token}/')
        self.assertEqual(open_response.status_code, status.HTTP_200_OK)
        review_request.refresh_from_db()
        self.assertEqual(review_request.status, ReviewRequest.STATUS_OPENED)
        self.assertIsNotNone(review_request.opened_at)

        reply_response = self.client.post(
            f'/api/review/{review_request.review_link.token}/feedback/',
            {
                'text': 'Relax the hi-hat shoulder and lean into the backbeat.',
                'feedback_category': 'technique',
                'timestamp_seconds': 42,
                'feedback_video': self._video_file(),
            },
            format='multipart',
        )

        self.assertEqual(reply_response.status_code, status.HTTP_201_CREATED)
        review_request.refresh_from_db()
        self.assertEqual(review_request.status, ReviewRequest.STATUS_RESPONDED)
        self.assertIsNotNone(review_request.responded_at)
        feedback = VideoFeedback.objects.get(session=self.session, user=self.teacher)
        self.assertEqual(feedback.feedback_category, 'technique')
        self.assertEqual(feedback.timestamp_seconds, 42)
        self.assertEqual(feedback.review_request, review_request)

    def test_student_can_mark_review_request_viewed(self):
        review_request = self._create_review_request()
        review_request.status = ReviewRequest.STATUS_RESPONDED
        review_request.responded_at = timezone.now()
        review_request.save(update_fields=['status', 'responded_at', 'updated_at'])

        self._auth(self.student)
        response = self.client.post(f'/api/review-requests/{review_request.id}/mark-viewed/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review_request.refresh_from_db()
        self.assertEqual(review_request.status, ReviewRequest.STATUS_VIEWED)
        self.assertIsNotNone(review_request.viewed_at)
        self.assertTrue(SessionLastSeen.objects.filter(user=self.student, session=self.session).exists())

    def test_student_opening_review_request_link_auto_marks_viewed_after_response(self):
        review_request = self._create_review_request()
        review_request.status = ReviewRequest.STATUS_RESPONDED
        review_request.responded_at = timezone.now()
        review_request.save(update_fields=['status', 'responded_at', 'updated_at'])

        self._auth(self.student)
        response = self.client.get(f'/api/review/{review_request.review_link.token}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review_request.refresh_from_db()
        self.assertEqual(review_request.status, ReviewRequest.STATUS_VIEWED)
        self.assertIsNotNone(review_request.viewed_at)
        self.assertTrue(SessionLastSeen.objects.filter(user=self.student, session=self.session).exists())

    def test_teacher_roster_includes_student_request_counts(self):
        self._create_review_request()

        self._auth(self.teacher)
        response = self.client.get('/api/teacher/roster/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['student']['id'], self.student.id)
        self.assertEqual(response.data[0]['pending_review_count'], 1)
        self.assertEqual(response.data[0]['total_review_count'], 1)

    def test_review_link_feedback_list_is_scoped_to_review_request(self):
        review_request = self._create_review_request()
        another_request = ReviewRequest.objects.create(
            session=self.session,
            student=self.student,
            teacher=self.teacher,
            created_by=self.student,
            instrument='drums',
            goal='Second thread',
            status=ReviewRequest.STATUS_RESPONDED,
        )
        VideoFeedback.objects.create(
            session=self.session,
            review_request=review_request,
            user=self.teacher,
            text='Feedback for request one',
            timestamp_seconds=12,
            feedback_video=self._video_file('one.mp4'),
            is_legacy_text_feedback=False,
        )
        VideoFeedback.objects.create(
            session=self.session,
            review_request=another_request,
            user=self.teacher,
            text='Feedback for request two',
            timestamp_seconds=34,
            feedback_video=self._video_file('two.mp4'),
            is_legacy_text_feedback=False,
        )

        self._auth(self.teacher)
        response = self.client.get(f'/api/review/{review_request.review_link.token}/feedback/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['text'], 'Feedback for request one')
        self.assertEqual(response.data[0]['review_request_id'], review_request.id)

    def test_teacher_can_manage_feedback_templates(self):
        self._auth(self.teacher)

        create_response = self.client.post(
            '/api/teacher/templates/',
            {
                'title': 'Groove timing reminder',
                'text': 'Relax your shoulders, lock with the click, and listen for consistent ghost-note volume.',
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        template_id = create_response.data['id']

        list_response = self.client.get('/api/teacher/templates/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['title'], 'Groove timing reminder')

        patch_response = self.client.patch(
            f'/api/teacher/templates/{template_id}/',
            {'text': 'Listen for the click and let the snare stay heavy on beats 2 and 4.'},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertIn('snare stay heavy', patch_response.data['text'])

        delete_response = self.client.delete(f'/api/teacher/templates/{template_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.data, {'ok': True})
        self.assertFalse(FeedbackTemplate.objects.filter(pk=template_id).exists())

    def test_review_request_detail_includes_request_specific_feedback_items(self):
        review_request = self._create_review_request()
        VideoFeedback.objects.create(
            session=self.session,
            review_request=review_request,
            user=self.teacher,
            feedback_category='timing',
            text='Focus on kick-snare balance.',
            timestamp_seconds=18,
            feedback_video=self._video_file('request-thread.mp4'),
            is_legacy_text_feedback=False,
        )

        self._auth(self.student)
        response = self.client.get(f'/api/review-requests/{review_request.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['feedback_items']), 1)
        self.assertEqual(response.data['feedback_items'][0]['text'], 'Focus on kick-snare balance.')
        self.assertEqual(response.data['feedback_items'][0]['review_request_id'], review_request.id)
        self.assertEqual(response.data['feedback_items'][0]['feedback_category'], 'timing')
        self.assertEqual(response.data['feedback_category_counts'], {'timing': 1})

    def test_student_can_create_follow_up_review_request_on_new_session(self):
        parent_request = self._create_review_request()
        new_session = Session.objects.create(
            user=self.student,
            title='Groove Practice Follow-up',
            description='Second take after feedback',
            video_file='sessions/groove-practice-follow-up.mp4',
            duration_seconds=190,
            processing_status=Session.STATUS_READY,
        )

        self._auth(self.student)
        response = self.client.post(
            '/api/review-requests/',
            {
                'session_id': new_session.id,
                'teacher_id': self.teacher.id,
                'parent_request_id': parent_request.id,
                'instrument': 'drums',
                'student_level': 'intermediate',
                'goal': 'Follow up after teacher notes',
                'exercise_or_song': 'Same groove, second take',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        child_request = ReviewRequest.objects.get(pk=response.data['id'])
        self.assertEqual(child_request.parent_request_id, parent_request.id)
        parent_request.refresh_from_db()
        self.assertEqual(parent_request.status, ReviewRequest.STATUS_RESUBMITTED)
        self.assertIsNotNone(parent_request.resubmitted_at)

    def test_follow_up_review_request_requires_same_teacher(self):
        parent_request = self._create_review_request()
        another_teacher = User.objects.create_user(username='other-teacher', password='pass1234')
        Profile.objects.create(user=another_teacher, display_name='Other Teacher')
        new_session = Session.objects.create(
            user=self.student,
            title='Follow-up mismatch',
            description='Should fail',
            video_file='sessions/follow-up-mismatch.mp4',
            duration_seconds=90,
            processing_status=Session.STATUS_READY,
        )

        self._auth(self.student)
        response = self.client.post(
            '/api/review-requests/',
            {
                'session_id': new_session.id,
                'teacher_id': another_teacher.id,
                'parent_request_id': parent_request.id,
                'instrument': 'drums',
                'goal': 'Wrong teacher follow-up',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('same teacher', response.data['teacher_id'][0].lower())
