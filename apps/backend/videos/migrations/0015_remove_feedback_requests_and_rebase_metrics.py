from django.db import migrations


def _drop_legacy_feedback_request_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute(
        """
        ALTER TABLE videos_coachevent
        DROP COLUMN IF EXISTS feedback_request_id CASCADE;
        """
    )


def _drop_legacy_table(schema_editor, table_name):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(f'DROP TABLE IF EXISTS {table_name} CASCADE;')
        return
    schema_editor.execute(f'DROP TABLE IF EXISTS {table_name};')


def _drop_feedback_assignment_table(apps, schema_editor):
    _drop_legacy_table(schema_editor, 'videos_feedbackassignment')


def _drop_feedback_request_table(apps, schema_editor):
    _drop_legacy_table(schema_editor, 'videos_feedbackrequest')


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0013_coachevent_coachdailymetric'),
    ]

    operations = [
        migrations.RunPython(
            _drop_legacy_feedback_request_column,
            migrations.RunPython.noop,
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
        migrations.RunPython(
            _drop_feedback_assignment_table,
            migrations.RunPython.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(
                    name='FeedbackAssignment',
                ),
            ],
            database_operations=[],
        ),
        migrations.RunPython(
            _drop_feedback_request_table,
            migrations.RunPython.noop,
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
