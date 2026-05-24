from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0041_session_ml_training_and_ml_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='timing_metadata',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='multipartsessionupload',
            name='timing_metadata',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
