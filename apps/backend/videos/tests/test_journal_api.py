from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from videos.models import JournalAttachment, JournalEntry, Routine, RoutineItem


def response_items(response):
    if isinstance(response.data, dict) and 'results' in response.data:
        return response.data['results']
    return response.data


class JournalApiTests(APITestCase):
    def setUp(self):
        self.member = User.objects.create_user(username='member-user', password='pass1234')
        self.other = User.objects.create_user(username='other-user', password='pass1234')
        self.client.force_authenticate(user=self.member)

    def test_routine_list_seeds_member_defaults(self):
        response = self.client.get('/api/routines/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = {item['name'] for item in response_items(response)}
        self.assertIn('Dental', names)
        self.assertIn('Fitness Basics', names)
        self.assertIn('Dragon and Tiger Qigong', names)
        self.assertIn('Drum Rudiments', names)
        self.assertTrue(Routine.objects.filter(user=self.member, is_default=True).exists())
        self.assertEqual(
            Routine.objects.get(user=self.member, is_today=True).name,
            'Dragon and Tiger Qigong',
        )
        self.assertEqual(
            Routine.objects.get(user=self.member, name='Dragon and Tiger Qigong').learned_from,
            'Dorothy',
        )

    def test_member_can_select_one_private_today_routine(self):
        first = Routine.objects.create(user=self.member, name='First routine', is_today=True)
        second = Routine.objects.create(user=self.member, name='Second routine')
        other_routine = Routine.objects.create(user=self.other, name='Other routine', is_today=True)

        response = self.client.post(f'/api/routines/{second.id}/select-today/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first.refresh_from_db()
        second.refresh_from_db()
        other_routine.refresh_from_db()
        self.assertFalse(first.is_today)
        self.assertTrue(second.is_today)
        self.assertTrue(other_routine.is_today)

        today_response = self.client.get('/api/routines/?today=1')
        today_items = response_items(today_response)
        self.assertEqual([item['id'] for item in today_items], [second.id])

    def test_member_can_create_custom_routine_and_item(self):
        routine_response = self.client.post(
            '/api/routines/',
            {
                'name': 'Morning Mobility',
                'category': 'Fitness',
                'purpose': 'Start the day with proof that future me matters.',
                'learned_from': 'Dorothy',
            },
            format='json',
        )

        self.assertEqual(routine_response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(routine_response.data['is_default'])
        self.assertEqual(routine_response.data['learned_from'], 'Dorothy')

        item_response = self.client.post(
            '/api/routine-items/',
            {
                'routine': routine_response.data['id'],
                'name': 'Couch stretch',
                'default_unit': 'minutes',
                'default_target_quantity': '2.00',
            },
            format='json',
        )

        self.assertEqual(item_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(item_response.data['name'], 'Couch stretch')

    def test_member_can_log_fitness_entry_against_routine_item(self):
        routine = Routine.objects.create(user=self.member, name='Pushup plan', category='Fitness')
        item = RoutineItem.objects.create(routine=routine, name='Pushups', default_unit='reps')

        response = self.client.post(
            '/api/journal-entries/',
            {
                'routine_item': item.id,
                'entry_type': JournalEntry.TYPE_FITNESS,
                'title': 'Pushups after breakfast',
                'category': 'Fitness',
                'metric_name': 'Pushups',
                'quantity': '25.00',
                'unit': 'reps',
                'notes': 'Clean reps.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['routine'], routine.id)
        self.assertEqual(response.data['routine_item'], item.id)
        self.assertEqual(response.data['quantity'], '25.00')

    def test_member_can_attach_meal_photo_to_journal_entry(self):
        entry = JournalEntry.objects.create(
            user=self.member,
            entry_type=JournalEntry.TYPE_MEAL,
            title='Rice bowl',
            category='Food',
        )
        image = SimpleUploadedFile(
            'meal.jpg',
            b'\xff\xd8\xff\xe0fake-jpeg',
            content_type='image/jpeg',
        )

        response = self.client.post(
            f'/api/journal-entries/{entry.id}/attachments/',
            {'file': image, 'caption': 'Lunch'},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['media_type'], JournalAttachment.TYPE_IMAGE)
        self.assertTrue(response.data['url'])

    def test_member_cannot_use_another_members_routine_item(self):
        other_routine = Routine.objects.create(user=self.other, name='Private plan')
        other_item = RoutineItem.objects.create(routine=other_routine, name='Private item')

        response = self.client.post(
            '/api/journal-entries/',
            {
                'routine_item': other_item.id,
                'entry_type': JournalEntry.TYPE_HABIT,
                'title': 'Should fail',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('routine_item', response.data)
