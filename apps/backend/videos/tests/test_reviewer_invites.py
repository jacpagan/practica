from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from videos.models import Profile, ReviewLink, ReviewerInvite, ReviewerRosterMembership, Session, SignupInviteCode


class ReviewerInviteApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner-user', password='pass1234')
        self.existing_reviewer = User.objects.create_user(username='existing-reviewer', password='pass1234')
        Profile.objects.create(user=self.owner, display_name='Session Owner')
        Profile.objects.create(user=self.existing_reviewer, display_name='Existing Reviewer')
        self.session = Session.objects.create(
            user=self.owner,
            title='Trusted Feedback Take',
            description='Working on subdivision clarity',
            video_file='sessions/trusted-feedback-take.mp4',
            duration_seconds=180,
            processing_status=Session.STATUS_READY,
        )

    def _auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_owner_can_create_reviewer_invite_for_ready_session(self):
        self._auth(self.owner)

        response = self.client.post(
            '/api/reviewer-invites/',
            {
                'session_id': self.session.id,
                'label': 'Invite trusted reviewer',
                'intent': 'lightweight_review',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['intent'], 'lightweight_review')
        self.assertTrue(bool(response.data['claim_code']))
        self.assertIn('/r/', response.data['invite_url'])
        self.assertIn('claim=', response.data['invite_url'])

        invite = ReviewerInvite.objects.get(pk=response.data['id'])
        self.assertEqual(invite.student, self.owner)
        self.assertEqual(invite.created_by, self.owner)
        self.assertEqual(invite.session, self.session)
        self.assertTrue(bool(invite.review_link))
        self.assertTrue(invite.invite_code.is_active)
        self.assertEqual(invite.invite_code.max_uses, 1)

    def test_registering_with_reviewer_invite_claims_it_and_creates_roster_membership(self):
        link = ReviewLink.objects.create(
            session=self.session,
            token='trusted-review-link',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='TRUSTED123', created_by=self.owner, max_uses=1)
        reviewer_invite = ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Join this review',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            expires_at=timezone.now() + timedelta(days=7),
        )

        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'new-reviewer',
                'password': 'pass1234',
                'display_name': 'New Reviewer',
                'invite_code': 'TRUSTED123',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        reviewer_invite.refresh_from_db()
        invite_code.refresh_from_db()
        reviewer = User.objects.get(username='new-reviewer')
        self.assertEqual(reviewer_invite.status, ReviewerInvite.STATUS_CLAIMED)
        self.assertEqual(reviewer_invite.claimed_by, reviewer)
        self.assertEqual(invite_code.use_count, 1)
        self.assertTrue(
            ReviewerRosterMembership.objects.filter(
                reviewer=reviewer,
                student=self.owner,
                is_active=True,
            ).exists()
        )

    def test_authenticated_member_opening_claim_link_claims_pending_invite(self):
        link = ReviewLink.objects.create(
            session=self.session,
            token='claim-review-link',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='CLAIM123', created_by=self.owner, max_uses=1)
        reviewer_invite = ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Claim this invite',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            expires_at=timezone.now() + timedelta(days=7),
        )

        self._auth(self.existing_reviewer)
        response = self.client.get(f'/api/review/{link.token}/?claim=CLAIM123')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        reviewer_invite.refresh_from_db()
        self.assertEqual(reviewer_invite.status, ReviewerInvite.STATUS_CLAIMED)
        self.assertEqual(reviewer_invite.claimed_by, self.existing_reviewer)
        self.assertTrue(
            ReviewerRosterMembership.objects.filter(
                reviewer=self.existing_reviewer,
                student=self.owner,
                is_active=True,
            ).exists()
        )

    def test_owner_can_list_and_revoke_pending_reviewer_invites(self):
        link = ReviewLink.objects.create(
            session=self.session,
            token='list-review-link',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='LIST123', created_by=self.owner, max_uses=1)
        reviewer_invite = ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Pending invite',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            expires_at=timezone.now() + timedelta(days=7),
        )
        self._auth(self.owner)

        list_response = self.client.get(f'/api/reviewer-invites/?session_id={self.session.id}')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]['id'], reviewer_invite.id)

        delete_response = self.client.delete(f'/api/reviewer-invites/{reviewer_invite.id}/')

        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)
        reviewer_invite.refresh_from_db()
        invite_code.refresh_from_db()
        self.assertEqual(reviewer_invite.status, ReviewerInvite.STATUS_REVOKED)
        self.assertFalse(invite_code.is_active)

    def test_second_member_cannot_take_over_claimed_reviewer_invite(self):
        second_reviewer = User.objects.create_user(username='second-reviewer', password='pass1234')
        Profile.objects.create(user=second_reviewer, display_name='Second Reviewer')
        link = ReviewLink.objects.create(
            session=self.session,
            token='claimed-review-link',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='CLAIMED123', created_by=self.owner, max_uses=1)
        reviewer_invite = ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Already claimed invite',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            claimed_by=self.existing_reviewer,
            claimed_at=timezone.now(),
            status=ReviewerInvite.STATUS_CLAIMED,
            expires_at=timezone.now() + timedelta(days=7),
        )

        self._auth(second_reviewer)
        response = self.client.post('/api/reviewer-invites/claim/', {'claim_code': 'CLAIMED123'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        reviewer_invite.refresh_from_db()
        self.assertEqual(reviewer_invite.claimed_by, self.existing_reviewer)
        self.assertFalse(
            ReviewerRosterMembership.objects.filter(
                reviewer=second_reviewer,
                student=self.owner,
                is_active=True,
            ).exists()
        )

    def test_revoked_reviewer_invite_cannot_be_claimed(self):
        link = ReviewLink.objects.create(
            session=self.session,
            token='revoked-review-link',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='REVOKED123', created_by=self.owner, max_uses=1, is_active=False)
        ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Revoked invite',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            status=ReviewerInvite.STATUS_REVOKED,
            expires_at=timezone.now() + timedelta(days=7),
        )

        self._auth(self.existing_reviewer)
        response = self.client.post('/api/reviewer-invites/claim/', {'claim_code': 'REVOKED123'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('turned off', str(response.data).lower())

    def test_expired_reviewer_invite_cannot_be_claimed_and_is_marked_expired(self):
        link = ReviewLink.objects.create(
            session=self.session,
            token='expired-review-link',
            created_by=self.owner,
            expires_at=timezone.now() - timedelta(minutes=5),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='EXPIRED123', created_by=self.owner, max_uses=1)
        reviewer_invite = ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Expired invite',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            expires_at=timezone.now() - timedelta(minutes=5),
        )

        self._auth(self.existing_reviewer)
        response = self.client.post('/api/reviewer-invites/claim/', {'claim_code': 'EXPIRED123'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        reviewer_invite.refresh_from_db()
        invite_code.refresh_from_db()
        self.assertEqual(reviewer_invite.status, ReviewerInvite.STATUS_EXPIRED)
        self.assertFalse(invite_code.is_active)

    def test_review_link_info_surfaces_claim_error_for_already_claimed_invite(self):
        second_reviewer = User.objects.create_user(username='third-reviewer', password='pass1234')
        Profile.objects.create(user=second_reviewer, display_name='Third Reviewer')
        link = ReviewLink.objects.create(
            session=self.session,
            token='claim-error-review-link',
            created_by=self.owner,
            expires_at=timezone.now() + timedelta(days=7),
            is_active=True,
            allow_video_feedback=True,
        )
        invite_code = SignupInviteCode.objects.create(code='ERROR123', created_by=self.owner, max_uses=1)
        ReviewerInvite.objects.create(
            created_by=self.owner,
            student=self.owner,
            invite_code=invite_code,
            review_link=link,
            session=self.session,
            label='Claim error invite',
            intent=ReviewerInvite.INTENT_LIGHTWEIGHT_REVIEW,
            claimed_by=self.existing_reviewer,
            claimed_at=timezone.now(),
            status=ReviewerInvite.STATUS_CLAIMED,
            expires_at=timezone.now() + timedelta(days=7),
        )

        self._auth(second_reviewer)
        response = self.client.get(f'/api/review/{link.token}/?claim=ERROR123')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('claim_error', response.data)
        self.assertIn('already been claimed', response.data['claim_error'].lower())
