import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0023_retire_legacy_spaces_plans_metrics'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Comment',
            new_name='VideoFeedback',
        ),
        migrations.RenameField(
            model_name='videofeedback',
            old_name='video_reply',
            new_name='feedback_video',
        ),
        migrations.RenameField(
            model_name='videofeedback',
            old_name='legacy_text_only',
            new_name='is_legacy_text_feedback',
        ),
        migrations.RenameField(
            model_name='reviewlink',
            old_name='allow_comments',
            new_name='allow_video_feedback',
        ),
        migrations.AlterField(
            model_name='videofeedback',
            name='session',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='video_feedback', to='videos.session'),
        ),
        migrations.AlterField(
            model_name='videofeedback',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='video_feedback', to='auth.user'),
        ),
        migrations.RemoveConstraint(
            model_name='videofeedback',
            name='comment_legacy_or_video_required',
        ),
        migrations.AddConstraint(
            model_name='videofeedback',
            constraint=models.CheckConstraint(
                condition=models.Q(is_legacy_text_feedback=True) | (models.Q(feedback_video__isnull=False) & ~models.Q(feedback_video='')),
                name='video_feedback_legacy_or_video_required',
            ),
        ),
    ]
