"""
WSGI config for practika_project project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# Use Heroku settings for Heroku deployment
if os.environ.get('DYNO') or os.environ.get('HEROKU') or os.environ.get('PORT'):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "practika_project.settings_heroku")
else:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "practika_project.settings")

application = get_wsgi_application()
