from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0013_coachevent_coachdailymetric'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ExerciseReferenceClip',
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
                ('exercise', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reference_clips', to='videos.exercise')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exercise_reference_clips', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', 'exercise', 'created_at'], name='exercise_clip_user_ex_time_idx'),
                    models.Index(fields=['youtube_video_id'], name='exercise_clip_video_id_idx'),
                    models.Index(fields=['youtube_playlist_id'], name='exercise_clip_playlist_id_idx'),
                ],
                'constraints': [
                    models.CheckConstraint(condition=models.Q(('start_seconds__gte', 0)), name='exercise_clip_start_seconds_gte_0'),
                    models.CheckConstraint(
                        condition=models.Q(('end_seconds__isnull', True), ('end_seconds__gt', models.F('start_seconds')), _connector='OR'),
                        name='exercise_clip_end_seconds_gt_start_or_null',
                    ),
                ],
            },
        ),
    ]
