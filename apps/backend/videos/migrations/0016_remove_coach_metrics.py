from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0015_remove_feedback_requests_and_rebase_metrics'),
    ]

    operations = [
        migrations.DeleteModel(
            name='CoachDailyMetric',
        ),
        migrations.DeleteModel(
            name='CoachEvent',
        ),
    ]
