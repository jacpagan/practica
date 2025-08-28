from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.core import mail
import re
from .models import Role, Profile, BetaInvitation


class AccountsTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Roles should be seeded by migration
        self.student_role = Role.objects.get(name='student')
        self.instructor_role = Role.objects.get(name='instructor')
        invitation = BetaInvitation.objects.create(email='invite@example.com')
        self.client.get(reverse('exercises:login') + f'?token={invitation.token}')

    def test_signup_page_loads(self):
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Sign Up')

    def test_login_page_loads(self):
        response = self.client.get(reverse('exercises:login'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Login')

    def test_user_signup(self):
        data = {
            'action': 'signup',
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123'
        }
        response = self.client.post(reverse('exercises:login'), data)
        self.assertEqual(response.status_code, 302)

        user = User.objects.get(username='testuser')
        self.assertEqual(user.email, 'test@example.com')

        profile = Profile.objects.get(user=user)
        self.assertEqual(profile.role, self.student_role)

    def test_user_login(self):
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        profile = Profile.objects.create(user=user, role=self.student_role)
        profile.verify_email()

        data = {
            'action': 'login',
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post(reverse('exercises:login'), data)
        self.assertEqual(response.status_code, 302)

        response = self.client.get(reverse('home'), follow=True)
        self.assertContains(response, 'Logout')  # Should show logout link when logged in


class PasswordResetTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='pwuser', email='pw@example.com', password='oldpassword'
        )

    def test_request_password_reset(self):
        response = self.client.post(
            reverse('accounts:password_reset'), {'email': 'pw@example.com'}
        )
        self.assertRedirects(response, reverse('accounts:password_reset_done'))
        self.assertEqual(len(mail.outbox), 1)

    def test_password_reset_confirm(self):
        mail.outbox = []
        self.client.post(
            reverse('accounts:password_reset'), {'email': 'pw@example.com'}
        )
        url = re.search(r"http://testserver(.+)", mail.outbox[0].body).group(1)
        response = self.client.get(url)
        post_url = response.url
        response = self.client.post(
            post_url,
            {
                'new_password1': 'newpass456',
                'new_password2': 'newpass456',
            },
        )
        self.assertRedirects(response, reverse('accounts:password_reset_complete'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newpass456'))

