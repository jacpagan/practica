from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0019_practice_plans_and_daily_checkins'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='reference_title',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='session',
            name='reference_url',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='multipartsessionupload',
            name='reference_title',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='multipartsessionupload',
            name='reference_url',
            field=models.URLField(blank=True),
        ),
    ]
