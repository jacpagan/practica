from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0022_reviewfeedback_author_user'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='session',
            name='space',
        ),
        migrations.RemoveField(
            model_name='multipartsessionupload',
            name='space',
        ),
        migrations.DeleteModel(
            name='CoachDailyMetric',
        ),
        migrations.DeleteModel(
            name='CoachEvent',
        ),
        migrations.DeleteModel(
            name='DailyCheckInItem',
        ),
        migrations.DeleteModel(
            name='DailyCheckIn',
        ),
        migrations.DeleteModel(
            name='InviteCode',
        ),
        migrations.DeleteModel(
            name='PracticePlanItem',
        ),
        migrations.DeleteModel(
            name='PracticePlan',
        ),
        migrations.DeleteModel(
            name='ExerciseReferenceClip',
        ),
        migrations.DeleteModel(
            name='SpaceMember',
        ),
        migrations.DeleteModel(
            name='ReviewFeedback',
        ),
        migrations.DeleteModel(
            name='Space',
        ),
    ]
