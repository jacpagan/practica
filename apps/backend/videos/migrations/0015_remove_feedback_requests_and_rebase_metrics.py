from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0013_coachevent_coachdailymetric'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE videos_coachevent
                DROP COLUMN IF EXISTS feedback_request_id CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='coachevent',
                    name='feedback_request',
                ),
            ],
            database_operations=[],
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS videos_feedbackassignment CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(
                    name='FeedbackAssignment',
                ),
            ],
            database_operations=[],
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS videos_feedbackrequest CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(
                    name='FeedbackRequest',
                ),
            ],
            database_operations=[],
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
