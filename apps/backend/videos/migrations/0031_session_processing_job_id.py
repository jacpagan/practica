from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0030_add_signup_invite_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='processing_job_id',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
    ]
