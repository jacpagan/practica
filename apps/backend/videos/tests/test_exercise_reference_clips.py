from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import Chapter, Exercise, ExerciseReferenceClip, Session, Space


class ExerciseReferenceClipModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='clip-model-user', password='pass1234')
        self.exercise = Exercise.objects.create(name='Circle Hands')

    def test_valid_clip_saves(self):
        clip = ExerciseReferenceClip.objects.create(
            user=self.user,
            exercise=self.exercise,
            title='Main phrase',
            youtube_url='https://www.youtube.com/watch?v=KZ149Rs_xMo',
            youtube_video_id='KZ149Rs_xMo',
            start_seconds=12,
            end_seconds=42,
        )
        self.assertIsNotNone(clip.id)

    def test_invalid_end_lte_start_fails(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ExerciseReferenceClip.objects.create(
                    user=self.user,
                    exercise=self.exercise,
                    title='Bad range',
                    youtube_url='https://www.youtube.com/watch?v=KZ149Rs_xMo',
                    youtube_video_id='KZ149Rs_xMo',
                    start_seconds=30,
                    end_seconds=30,
                )


class ExerciseReferenceClipApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='clip-api-user', password='pass1234')
        self.other_user = User.objects.create_user(username='clip-api-other', password='pass1234')
        self.exercise = Exercise.objects.create(name='Circle Hands API')
        self.space = Space.objects.create(name='Clip Space', owner=self.user)
        self.session = Session.objects.create(
            user=self.user,
            space=self.space,
            title='Practice Session',
            description='seed',
            video_file=SimpleUploadedFile('seed.mp4', b'video-data', content_type='video/mp4'),
        )
        Chapter.objects.create(
            session=self.session,
            exercise=self.exercise,
            title='Circle Hands',
            timestamp_seconds=15,
            end_seconds=45,
            notes='Initial run',
        )

    def _create_clip(self, owner, **overrides):
        defaults = {
            'exercise': self.exercise,
            'title': 'Reference',
            'youtube_url': 'https://www.youtube.com/watch?v=KZ149Rs_xMo',
            'youtube_video_id': 'KZ149Rs_xMo',
            'youtube_playlist_id': '',
            'start_seconds': 10,
            'end_seconds': 40,
            'notes': '',
        }
        defaults.update(overrides)
        return ExerciseReferenceClip.objects.create(user=owner, **defaults)

    def test_auth_required_for_reference_clips(self):
        response = self.client.post(
            f'/api/exercises/{self.exercise.id}/reference-clips/',
            {
                'title': 'Unauthed',
                'youtube_url': 'https://www.youtube.com/watch?v=KZ149Rs_xMo',
                'start_seconds': 0,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_accepts_watch_and_short_urls_and_normalizes(self):
        self.client.force_authenticate(user=self.user)

        watch_res = self.client.post(
            f'/api/exercises/{self.exercise.id}/reference-clips/',
            {
                'title': 'Watch URL',
                'youtube_url': 'https://www.youtube.com/watch?v=KZ149Rs_xMo&list=PLar09_QaB_IN-ka8YZ1dvPZWrsd4vw84Q',
                'start_seconds': 8,
                'end_seconds': 28,
            },
            format='json',
        )
        self.assertEqual(watch_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(watch_res.data['youtube_video_id'], 'KZ149Rs_xMo')
        self.assertEqual(watch_res.data['youtube_playlist_id'], 'PLar09_QaB_IN-ka8YZ1dvPZWrsd4vw84Q')
        self.assertTrue(watch_res.data['youtube_url'].startswith('https://www.youtube.com/watch?v=KZ149Rs_xMo'))
        self.assertIn('embed/', watch_res.data['embed_url'])
        self.assertIn('t=8s', watch_res.data['watch_url_with_start'])

        short_res = self.client.post(
            f'/api/exercises/{self.exercise.id}/reference-clips/',
            {
                'title': 'Short URL',
                'youtube_url': 'https://youtu.be/KZ149Rs_xMo',
                'start_seconds': 0,
            },
            format='json',
        )
        self.assertEqual(short_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(short_res.data['youtube_video_id'], 'KZ149Rs_xMo')

    def test_invalid_url_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/exercises/{self.exercise.id}/reference-clips/',
            {
                'title': 'Bad URL',
                'youtube_url': 'https://vimeo.com/123',
                'start_seconds': 0,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('youtube_url', response.data)

    def test_ownership_scope_and_update_delete_guards(self):
        self.client.force_authenticate(user=self.user)
        own = self._create_clip(owner=self.user, title='Mine')
        other = self._create_clip(owner=self.other_user, title='Theirs')

        list_res = self.client.get(f'/api/exercises/{self.exercise.id}/reference-clips/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data), 1)
        self.assertEqual(list_res.data[0]['id'], own.id)

        patch_other = self.client.patch(
            f'/api/exercises/{self.exercise.id}/reference-clips/{other.id}/',
            {'title': 'Nope'},
            format='json',
        )
        self.assertEqual(patch_other.status_code, status.HTTP_404_NOT_FOUND)

        delete_other = self.client.delete(
            f'/api/exercises/{self.exercise.id}/reference-clips/{other.id}/',
        )
        self.assertEqual(delete_other.status_code, status.HTTP_404_NOT_FOUND)

        patch_own = self.client.patch(
            f'/api/exercises/{self.exercise.id}/reference-clips/{own.id}/',
            {'notes': 'Updated'},
            format='json',
        )
        self.assertEqual(patch_own.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_own.data['notes'], 'Updated')

        delete_own = self.client.delete(
            f'/api/exercises/{self.exercise.id}/reference-clips/{own.id}/',
        )
        self.assertEqual(delete_own.status_code, status.HTTP_204_NO_CONTENT)

    def test_progress_payload_includes_reference_clips_and_existing_keys(self):
        self.client.force_authenticate(user=self.user)
        self._create_clip(owner=self.user, title='Mine for progress')
        self._create_clip(owner=self.other_user, title='Other user clip')

        response = self.client.get(f'/api/exercises/{self.exercise.id}/progress/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('exercise', response.data)
        self.assertIn('chapters', response.data)
        self.assertIn('reference_clips', response.data)
        self.assertEqual(len(response.data['chapters']), 1)
        self.assertEqual(len(response.data['reference_clips']), 1)
        self.assertEqual(response.data['reference_clips'][0]['title'], 'Mine for progress')
