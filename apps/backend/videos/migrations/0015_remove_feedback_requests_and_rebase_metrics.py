from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0014_exercisereferenceclip'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='coachevent',
            name='feedback_request',
        ),
        migrations.DeleteModel(
            name='FeedbackAssignment',
        ),
        migrations.DeleteModel(
            name='FeedbackRequest',
        ),
        migrations.RenameField(
            model_name='coachdailymetric',
            old_name='feedback_completions_7d',
            new_name='coach_comments_7d',
        ),
        migrations.RenameField(
            model_name='coachdailymetric',
            old_name='feedback_completions_30d',
            new_name='coach_comments_30d',
        ),
        migrations.RenameField(
            model_name='coachdailymetric',
            old_name='median_time_to_feedback_hours_30d',
            new_name='median_time_to_first_coach_comment_hours_30d',
        ),
    ]
