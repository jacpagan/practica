from django.db import migrations, models
import django.db.models.deletion


def mark_legacy_text_only_comments(apps, schema_editor):
    Comment = apps.get_model('videos', 'Comment')
    Comment.objects.filter(video_reply='').update(legacy_text_only=True)
    Comment.objects.filter(video_reply__isnull=True).update(legacy_text_only=True)


def mark_existing_sessions_ready(apps, schema_editor):
    Session = apps.get_model('videos', 'Session')
    Session.objects.filter(processing_status='uploaded').update(processing_status='ready')


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0016_remove_coach_metrics'),
    ]

    operations = [
        migrations.AddField(
            model_name='comment',
            name='legacy_text_only',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='session',
            name='processing_error',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='session',
            name='processing_status',
            field=models.CharField(
                choices=[
                    ('uploaded', 'Uploaded'),
                    ('processing', 'Processing'),
                    ('ready', 'Ready'),
                    ('failed', 'Failed'),
                ],
                default='uploaded',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='space',
            name='main_session',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='main_in_spaces',
                to='videos.session',
            ),
        ),
        migrations.CreateModel(
            name='SessionAsset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('asset_type', models.CharField(choices=[('proxy_mp4', 'Proxy MP4'), ('hls_master', 'HLS Master'), ('thumb_sprite', 'Thumbnail Sprite'), ('thumb_vtt', 'Thumbnail VTT')], max_length=32)),
                ('object_key', models.CharField(max_length=512)),
                ('content_type', models.CharField(blank=True, max_length=120)),
                ('metadata_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assets', to='videos.session')),
            ],
            options={
                'ordering': ['asset_type', '-created_at'],
                'constraints': [models.UniqueConstraint(fields=('session', 'asset_type'), name='session_asset_session_type_uniq')],
            },
        ),
        migrations.RunPython(mark_existing_sessions_ready, migrations.RunPython.noop),
        migrations.RunPython(mark_legacy_text_only_comments, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='comment',
            constraint=models.CheckConstraint(
                check=models.Q(legacy_text_only=True) | (models.Q(video_reply__isnull=False) & ~models.Q(video_reply='')),
                name='comment_legacy_or_video_required',
            ),
        ),
    ]
