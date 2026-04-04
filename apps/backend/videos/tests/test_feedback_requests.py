from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import FeedbackTemplate, Profile, ReviewRequest, ReviewerRosterMembership, Session, SessionLastSeen, VideoFeedback


class FeedbackRequestApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin-user', password='pass1234', is_staff=True)
        self.student = User.objects.create_user(username='student-user', password='pass1234')
        self.reviewer = User.objects.create_user(username='reviewer-user', password='pass1234')
        self.outsider = User.objects.create_user(username='outsider-user', password='pass1234')
        Profile.objects.create(user=self.admin, display_name='Studio Admin')
        Profile.objects.create(user=self.student, display_name='Student Musician')
        Profile.objects.create(user=self.reviewer, display_name='Drum Reviewer')
        Profile.objects.create(user=self.outsider, display_name='Random Reviewer')
        self.roster_membership = ReviewerRosterMembership.objects.create(
            reviewer=self.reviewer,
            student=self.student,
            created_by=self.admin,
            is_active=True,
        )
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
                'reviewer_id': self.reviewer.id,
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

    def test_owner_can_create_feedback_request_with_designated_reviewer(self):
        review_request = self._create_review_request()

        self.assertEqual(review_request.student, self.student)
        self.assertEqual(review_request.reviewer, self.reviewer)
        self.assertEqual(review_request.status, ReviewRequest.STATUS_REQUESTED)
        self.assertEqual(review_request.instrument, 'drums')
        self.assertTrue(bool(review_request.review_link))
        self.roster_membership.refresh_from_db()
        self.assertTrue(self.roster_membership.is_active)
        self.assertEqual(self.roster_membership.created_by, self.admin)
        self.assertEqual(
            ReviewerRosterMembership.objects.filter(
                reviewer=self.reviewer,
                student=self.student,
                is_active=True,
            ).count(),
            1,
        )

    def test_owner_cannot_create_feedback_request_for_reviewer_outside_roster(self):
        self._auth(self.student)
        response = self.client.post(
            '/api/review-requests/',
            {
                'session_id': self.session.id,
                'reviewer_id': self.outsider.id,
                'instrument': 'drums',
                'student_level': 'intermediate',
                'goal': 'Improve ghost-note consistency',
                'exercise_or_song': 'Funky groove in 4/4',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('designated reviewer', response.data['reviewer_id'][0].lower())
        self.assertFalse(ReviewRequest.objects.filter(student=self.student, reviewer=self.outsider).exists())

    def test_feedback_inbox_lists_assigned_feedback_requests(self):
        review_request = self._create_review_request()

        self._auth(self.reviewer)
        response = self.client.get('/api/inbox/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], review_request.id)
        self.assertEqual(response.data[0]['current_member_role'], 'reviewer')

    def test_outsider_cannot_reply_via_review_request_link(self):
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
        self.assertFalse(VideoFeedback.objects.filter(review_request=review_request).exists())

    def test_outsider_cannot_open_review_request_link(self):
        review_request = self._create_review_request()

        self._auth(self.outsider)
        response = self.client.get(f'/api/review/{review_request.review_link.token}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'review_request_forbidden')

    def test_reviewer_open_and_reply_updates_feedback_request_status(self):
        review_request = self._create_review_request()

        self._auth(self.reviewer)
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
        feedback = VideoFeedback.objects.get(session=self.session, user=self.reviewer)
        self.assertEqual(feedback.feedback_category, 'technique')
        self.assertEqual(feedback.timestamp_seconds, 42)
        self.assertEqual(feedback.review_request, review_request)

    def test_owner_can_mark_feedback_request_viewed(self):
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

    def test_owner_cannot_mark_feedback_request_viewed_before_response(self):
        review_request = self._create_review_request()

        self._auth(self.student)
        response = self.client.post(f'/api/review-requests/{review_request.id}/mark-viewed/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        review_request.refresh_from_db()
        self.assertEqual(review_request.status, ReviewRequest.STATUS_REQUESTED)

    def test_owner_opening_feedback_request_link_auto_marks_viewed_after_response(self):
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

    def test_member_connections_include_owner_request_counts(self):
        self._create_review_request()

        self._auth(self.reviewer)
        response = self.client.get('/api/connections/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['member']['id'], self.student.id)
        self.assertEqual(response.data[0]['pending_review_count'], 1)
        self.assertEqual(response.data[0]['total_review_count'], 1)

    def test_owner_connections_list_designated_reviewers(self):
        self._create_review_request()

        self._auth(self.student)
        response = self.client.get('/api/connections/?role=student')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['reviewer']['id'], self.reviewer.id)
        self.assertEqual(response.data[0]['student']['id'], self.student.id)
        self.assertEqual(response.data[0]['pending_review_count'], 1)
        self.assertEqual(response.data[0]['total_review_count'], 1)

    def test_reviewer_roster_alias_matches_member_connections(self):
        self._create_review_request()

        self._auth(self.reviewer)
        response = self.client.get('/api/reviewer/roster/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['member']['id'], self.student.id)

    def test_review_link_feedback_list_is_scoped_to_review_request(self):
        review_request = self._create_review_request()
        another_request = ReviewRequest.objects.create(
            session=self.session,
            student=self.student,
            reviewer=self.reviewer,
            created_by=self.student,
            instrument='drums',
            goal='Second thread',
            status=ReviewRequest.STATUS_RESPONDED,
        )
        VideoFeedback.objects.create(
            session=self.session,
            review_request=review_request,
            user=self.reviewer,
            text='Feedback for request one',
            timestamp_seconds=12,
            feedback_video=self._video_file('one.mp4'),
            is_legacy_text_feedback=False,
        )
        VideoFeedback.objects.create(
            session=self.session,
            review_request=another_request,
            user=self.reviewer,
            text='Feedback for request two',
            timestamp_seconds=34,
            feedback_video=self._video_file('two.mp4'),
            is_legacy_text_feedback=False,
        )

        self._auth(self.reviewer)
        response = self.client.get(f'/api/review/{review_request.review_link.token}/feedback/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['text'], 'Feedback for request one')
        self.assertEqual(response.data[0]['review_request_id'], review_request.id)

    def test_reviewer_can_manage_feedback_templates(self):
        self._auth(self.reviewer)

        create_response = self.client.post(
            '/api/feedback-templates/',
            {
                'title': 'Groove timing reminder',
                'text': 'Relax your shoulders, lock with the click, and listen for consistent ghost-note volume.',
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        template_id = create_response.data['id']

        list_response = self.client.get('/api/feedback-templates/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['title'], 'Groove timing reminder')

        patch_response = self.client.patch(
            f'/api/feedback-templates/{template_id}/',
            {'text': 'Listen for the click and let the snare stay heavy on beats 2 and 4.'},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertIn('snare stay heavy', patch_response.data['text'])

        delete_response = self.client.delete(f'/api/feedback-templates/{template_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.data, {'ok': True})
        self.assertFalse(FeedbackTemplate.objects.filter(pk=template_id).exists())

    def test_reviewer_can_mark_request_needs_resubmission_with_event(self):
        review_request = self._create_review_request()

        self._auth(self.reviewer)
        response = self.client.patch(
            f'/api/review-requests/{review_request.id}/',
            {
                'status': 'needs_resubmission',
                'status_reason': 'needs_new_take',
                'status_note': 'Please send a cleaner full take from bar 1.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        review_request.refresh_from_db()
        self.assertEqual(review_request.status, ReviewRequest.STATUS_NEEDS_RESUBMISSION)
        self.assertEqual(review_request.status_reason, ReviewRequest.REASON_NEEDS_NEW_TAKE)
        self.assertIn('cleaner full take', review_request.status_note)
        self.assertEqual(response.data['events'][0]['to_status'], ReviewRequest.STATUS_NEEDS_RESUBMISSION)
        self.assertEqual(response.data['events'][0]['reason_code'], ReviewRequest.REASON_NEEDS_NEW_TAKE)

    def test_flagged_request_is_hidden_from_reviewer_inbox(self):
        review_request = self._create_review_request()

        self._auth(self.reviewer)
        patch_response = self.client.patch(
            f'/api/review-requests/{review_request.id}/',
            {
                'status': 'flagged',
                'status_reason': 'unsafe_content',
                'status_note': 'This upload looks inappropriate for the thread.',
            },
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        inbox_response = self.client.get('/api/inbox/')
        self.assertEqual(inbox_response.status_code, status.HTTP_200_OK)
        self.assertEqual(inbox_response.data, [])

    def test_review_request_detail_includes_request_specific_feedback_items(self):
        review_request = self._create_review_request()
        VideoFeedback.objects.create(
            session=self.session,
            review_request=review_request,
            user=self.reviewer,
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

    def test_owner_can_create_follow_up_feedback_request_on_new_session(self):
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
                'reviewer_id': self.reviewer.id,
                'parent_request_id': parent_request.id,
                'instrument': 'drums',
                'student_level': 'intermediate',
                'goal': 'Follow up after reviewer notes',
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

    def test_follow_up_feedback_request_requires_same_reviewer(self):
        parent_request = self._create_review_request()
        another_reviewer = User.objects.create_user(username='other-reviewer', password='pass1234')
        Profile.objects.create(user=another_reviewer, display_name='Other Reviewer')
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
                'reviewer_id': another_reviewer.id,
                'parent_request_id': parent_request.id,
                'instrument': 'drums',
                'goal': 'Wrong reviewer follow-up',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('same reviewer', response.data['reviewer_id'][0].lower())

    def test_feedback_insights_returns_category_and_member_trends(self):
        review_request = self._create_review_request()
        follow_up_session = Session.objects.create(
            user=self.student,
            title='Trend Follow-up Session',
            description='Third take',
            video_file='sessions/trend-follow-up.mp4',
            duration_seconds=120,
            processing_status=Session.STATUS_READY,
        )
        follow_up_request = ReviewRequest.objects.create(
            session=follow_up_session,
            student=self.student,
            reviewer=self.reviewer,
            created_by=self.student,
            parent_request=review_request,
            instrument='drums',
            goal='Keep tightening the groove',
            status=ReviewRequest.STATUS_RESPONDED,
        )
        VideoFeedback.objects.create(
            session=self.session,
            review_request=review_request,
            user=self.reviewer,
            feedback_category='timing',
            text='Timing note one',
            feedback_video=self._video_file('timing.mp4'),
            is_legacy_text_feedback=False,
        )
        VideoFeedback.objects.create(
            session=follow_up_session,
            review_request=follow_up_request,
            user=self.reviewer,
            feedback_category='groove',
            text='Groove note one',
            feedback_video=self._video_file('groove.mp4'),
            is_legacy_text_feedback=False,
        )

        self._auth(self.reviewer)
        response = self.client.get('/api/feedback-insights/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_review_requests'], 2)
        self.assertEqual(response.data['follow_up_review_requests'], 1)
        self.assertEqual(response.data['category_counts'], {'timing': 1, 'groove': 1})
        self.assertEqual(len(response.data['top_students']), 1)
        self.assertEqual(response.data['top_students'][0]['request_count'], 2)
        self.assertEqual(response.data['top_students'][0]['follow_up_request_count'], 1)
