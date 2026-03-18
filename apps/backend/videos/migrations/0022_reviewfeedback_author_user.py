from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0021_review_links'),
    ]

    operations = [
        migrations.AddField(
            model_name='reviewfeedback',
            name='author_user',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='authored_review_feedback', to=settings.AUTH_USER_MODEL),
        ),
    ]
