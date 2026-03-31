from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0031_session_processing_job_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='videofeedback',
            name='client_upload_id',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
    ]
