from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Profile, Space, SpaceMember, Session, FeedbackRequest, FeedbackAssignment


@override_settings(FEEDBACK_REQUESTS_ENABLED=True)
class FeedbackRequestsApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass1234')
        self.member = User.objects.create_user(username='member', password='pass1234')
        self.outsider = User.objects.create_user(username='outsider', password='pass1234')

        Profile.objects.create(user=self.owner, display_name='Owner')
        Profile.objects.create(user=self.member, display_name='Member')
        Profile.objects.create(user=self.outsider, display_name='Outsider')

        self.space = Space.objects.create(name='Drumming', owner=self.owner)
        SpaceMember.objects.create(space=self.space, user=self.member)

        self.owner_session = Session.objects.create(
            user=self.owner,
            space=self.space,
            title='Owner Session',
            description='Base session',
            video_file=self._video_file('owner.mp4'),
        )

    def _video_file(self, name='clip.mp4'):
        return SimpleUploadedFile(name, b'fake-video-data', content_type='video/mp4')

    def _create_feedback_request(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/sessions/{self.owner_session.id}/feedback-request/',
            {'focus_prompt': 'Please review timing and clarity', 'sla_hours': 48},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data['id']

    def test_member_can_post_to_joined_space_but_cannot_edit_others_session(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.post(
            '/api/sessions/',
            {
                'title': 'Member Session',
                'description': 'Uploaded by space member',
                'video_file': self._video_file('member.mp4'),
                'space': self.space.id,
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.patch(
            f'/api/sessions/{self.owner_session.id}/',
            {'title': 'Illegal edit'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_feedback_request_lifecycle_claim_complete_fulfilled(self):
        request_id = self._create_feedback_request()

        self.client.force_authenticate(user=self.member)
        claim_response = self.client.post(f'/api/feedback-requests/{request_id}/claim/')
        self.assertEqual(claim_response.status_code, status.HTTP_201_CREATED)

        complete_response = self.client.post(
            f'/api/feedback-requests/{request_id}/complete/',
            {
                'text': 'Great work, tighten the groove at 0:45.',
                'video_reply': self._video_file('review.mp4'),
            },
            format='multipart',
        )
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)

        feedback_request = FeedbackRequest.objects.get(pk=request_id)
        self.assertEqual(feedback_request.status, FeedbackRequest.STATUS_FULFILLED)
        self.assertEqual(feedback_request.assignments.filter(status=FeedbackAssignment.STATUS_COMPLETED).count(), 1)

    def test_video_requirement_is_enforced_before_final_completion(self):
        request_id = self._create_feedback_request()

        self.client.force_authenticate(user=self.member)
        self.client.post(f'/api/feedback-requests/{request_id}/claim/')

        complete_without_video = self.client.post(
            f'/api/feedback-requests/{request_id}/complete/',
            {'text': 'Notes only, no video attached.'},
            format='multipart',
        )
        self.assertEqual(complete_without_video.status_code, status.HTTP_400_BAD_REQUEST)

        feedback_request = FeedbackRequest.objects.get(pk=request_id)
        self.assertEqual(feedback_request.status, FeedbackRequest.STATUS_OPEN)
        assignment = feedback_request.assignments.get(reviewer=self.member)
        self.assertEqual(assignment.status, FeedbackAssignment.STATUS_CLAIMED)

    def test_sla_expiry_transitions_requests_and_claims(self):
        request_id = self._create_feedback_request()

        self.client.force_authenticate(user=self.member)
        self.client.post(f'/api/feedback-requests/{request_id}/claim/')

        FeedbackRequest.objects.filter(pk=request_id).update(due_at=timezone.now() - timedelta(hours=1))

        response = self.client.get('/api/feedback-requests/open/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        feedback_request = FeedbackRequest.objects.get(pk=request_id)
        self.assertEqual(feedback_request.status, FeedbackRequest.STATUS_EXPIRED)
        assignment = feedback_request.assignments.get(reviewer=self.member)
        self.assertEqual(assignment.status, FeedbackAssignment.STATUS_EXPIRED)

    def test_membership_and_owner_guards(self):
        request_id = self._create_feedback_request()

        self.client.force_authenticate(user=self.outsider)
        claim_response = self.client.post(f'/api/feedback-requests/{request_id}/claim/')
        self.assertEqual(claim_response.status_code, status.HTTP_403_FORBIDDEN)

        create_response = self.client.post(
            f'/api/sessions/{self.owner_session.id}/feedback-request/',
            {'focus_prompt': 'Outsider should not request here'},
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_404_NOT_FOUND)
