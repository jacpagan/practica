from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse

from .models import Role, Profile


class AccountsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.student_role = Role.objects.get(name="student")

    def test_signup_page_loads(self):
        response = self.client.get(reverse("accounts:signup"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sign Up")

    def test_login_page_loads(self):
        response = self.client.get(reverse("accounts:login"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Login")

    def test_user_signup(self):
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password1": "testpass123",
            "password2": "testpass123",
        }
        response = self.client.post(reverse("accounts:signup"), data)
        self.assertEqual(response.status_code, 302)

        user = User.objects.get(username="testuser")
        self.assertEqual(user.email, "test@example.com")

        profile = Profile.objects.get(user=user)
        self.assertEqual(profile.role, self.student_role)

    def test_user_login(self):
        user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )
        profile = Profile.objects.create(user=user, role=self.student_role)
        profile.verify_email()

        response = self.client.post(
            reverse("accounts:login"),
            {"username": "testuser", "password": "testpass123"},
        )
        self.assertEqual(response.status_code, 302)

        response = self.client.get(reverse("home"), follow=True)
        self.assertContains(response, "Logout")

