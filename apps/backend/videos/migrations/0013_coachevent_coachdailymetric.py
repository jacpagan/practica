from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0012_multipartsessionupload'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CoachDailyMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('active_students_30d', models.PositiveIntegerField(default=0)),
                ('feedback_completions_7d', models.PositiveIntegerField(default=0)),
                ('feedback_completions_30d', models.PositiveIntegerField(default=0)),
                ('median_time_to_feedback_hours_30d', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('estimated_time_saved_hours_30d', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('coach', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coach_daily_metrics', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['date'],
            },
        ),
        migrations.CreateModel(
            name='CoachEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('session_uploaded', 'Session Uploaded'), ('feedback_requested', 'Feedback Requested'), ('feedback_claimed', 'Feedback Claimed'), ('feedback_completed', 'Feedback Completed'), ('video_feedback_completed', 'Video Feedback Completed')], max_length=32)),
                ('occurred_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('feedback_request', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coach_events', to='videos.feedbackrequest')),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coach_events', to='videos.session')),
                ('space', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coach_events', to='videos.space')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coach_events', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-occurred_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='coachdailymetric',
            constraint=models.UniqueConstraint(fields=('coach', 'date'), name='coach_daily_metric_cd_uniq'),
        ),
        migrations.AddIndex(
            model_name='coachdailymetric',
            index=models.Index(fields=['coach', 'date'], name='coach_daily_metric_cd_idx'),
        ),
        migrations.AddIndex(
            model_name='coachevent',
            index=models.Index(fields=['user', 'event_type', 'occurred_at'], name='coach_event_user_type_time_idx'),
        ),
    ]
