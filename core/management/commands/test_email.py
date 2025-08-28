from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings


class Command(BaseCommand):
    help = 'Test email sending functionality'

    def add_arguments(self, parser):
        parser.add_argument('--to', type=str, help='Email address to send test to')
        parser.add_argument('--subject', type=str, default='Test Email from Practika', help='Email subject')
        parser.add_argument('--message', type=str, default='This is a test email from your Practika application.', help='Email message')

    def handle(self, *args, **options):
        to_email = options['to']
        subject = options['subject']
        message = options['message']
        
        if not to_email:
            self.stdout.write(self.style.ERROR('Please provide a --to email address'))
            return
        
        self.stdout.write(f'Testing email sending to: {to_email}')
        self.stdout.write(f'Subject: {subject}')
        self.stdout.write(f'Message: {message}')
        self.stdout.write(f'Email backend: {settings.EMAIL_BACKEND}')
        
        try:
            # Send test email
            result = send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[to_email],
                fail_silently=False,
            )
            
            if result:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Test email sent successfully! ({result} emails sent)')
                )
            else:
                self.stdout.write(
                    self.style.WARNING('⚠️ Email was not sent (result: 0)')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Failed to send test email: {e}')
            )
            self.stdout.write('This might be due to missing SendGrid configuration.')
