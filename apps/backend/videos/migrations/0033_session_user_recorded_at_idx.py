from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0032_videofeedback_client_upload_id'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='session',
            index=models.Index(fields=['user', 'recorded_at'], name='videos_sess_user_recorded_idx'),
        ),
    ]

