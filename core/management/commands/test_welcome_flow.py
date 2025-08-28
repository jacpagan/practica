from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.test import Client
from django.urls import reverse
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Test the welcome flow functionality'

    def handle(self, *args, **options):
        self.stdout.write('🧪 Testing Welcome Flow...')
        
        # Test 1: Check if welcome URL is accessible
        try:
            client = Client()
            welcome_url = reverse('exercises:welcome')
            self.stdout.write(f'✅ Welcome URL: {welcome_url}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Welcome URL error: {e}'))
            return
        
        # Test 2: Check if welcome template exists
        try:
            from django.template.loader import get_template
            template = get_template('exercises/welcome.html')
            self.stdout.write('✅ Welcome template found')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Welcome template error: {e}'))
            return
        
        # Test 3: Check if base template exists
        try:
            base_template = get_template('base.html')
            self.stdout.write('✅ Base template found')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Base template error: {e}'))
            return
        
        # Test 4: Check URL patterns
        try:
            from exercises.urls import urlpatterns
            welcome_patterns = [p for p in urlpatterns if 'welcome' in str(p)]
            if welcome_patterns:
                self.stdout.write('✅ Welcome URL pattern found in exercises.urls')
            else:
                self.stdout.write(self.style.WARNING('⚠️ No welcome URL pattern found'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ URL pattern check error: {e}'))
        
        # Test 5: Check view function
        try:
            from exercises.views import welcome_flow
            self.stdout.write('✅ Welcome flow view function found')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Welcome flow view error: {e}'))
        
        self.stdout.write(self.style.SUCCESS('🎯 Welcome flow test completed!'))
        self.stdout.write('📝 If you see any ❌ errors above, those need to be fixed.')
