from django.db import migrations


def _drop_legacy_table(schema_editor, table_name):
    if schema_editor.connection.vendor == 'postgresql':
        schema_editor.execute(f'DROP TABLE IF EXISTS {table_name} CASCADE;')
        return
    schema_editor.execute(f'DROP TABLE IF EXISTS {table_name};')


def _drop_coachdailymetric_table(apps, schema_editor):
    _drop_legacy_table(schema_editor, 'videos_coachdailymetric')


def _drop_coachevent_table(apps, schema_editor):
    _drop_legacy_table(schema_editor, 'videos_coachevent')


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
        migrations.RunPython(
            _drop_coachdailymetric_table,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(
            _drop_coachevent_table,
            migrations.RunPython.noop,
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
