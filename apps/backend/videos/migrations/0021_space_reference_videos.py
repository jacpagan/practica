from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0020_session_reference_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SpaceReferenceVideo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('youtube_url', models.URLField()),
                ('youtube_video_id', models.CharField(max_length=32)),
                ('youtube_playlist_id', models.CharField(blank=True, default='', max_length=64)),
                ('start_seconds', models.PositiveIntegerField(default=0)),
                ('end_seconds', models.PositiveIntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='space_reference_videos', to=settings.AUTH_USER_MODEL)),
                ('space', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reference_videos', to='videos.space')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='spacereferencevideo',
            index=models.Index(fields=['space', 'created_at'], name='space_reference_video_space_time_idx'),
        ),
        migrations.AddIndex(
            model_name='spacereferencevideo',
            index=models.Index(fields=['youtube_video_id'], name='space_reference_video_id_idx'),
        ),
        migrations.AddConstraint(
            model_name='spacereferencevideo',
            constraint=models.CheckConstraint(check=models.Q(start_seconds__gte=0), name='space_reference_start_seconds_gte_0'),
        ),
        migrations.AddConstraint(
            model_name='spacereferencevideo',
            constraint=models.CheckConstraint(
                check=models.Q(end_seconds__isnull=True) | models.Q(end_seconds__gt=models.F('start_seconds')),
                name='space_reference_end_seconds_gt_start_or_null',
            ),
        ),
    ]
