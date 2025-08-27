import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practika_project.settings')

app = Celery('practika_project')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):  # pragma: no cover - debug helper
    print(f'Request: {self.request!r}')
