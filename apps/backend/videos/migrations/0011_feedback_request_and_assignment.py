from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0010_remove_profile_role_space_invite_slug_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FeedbackRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('open', 'Open'), ('fulfilled', 'Fulfilled'), ('expired', 'Expired'), ('cancelled', 'Cancelled')], default='open', max_length=16)),
                ('sla_hours', models.PositiveIntegerField(default=48)),
                ('due_at', models.DateTimeField()),
                ('required_reviews', models.PositiveIntegerField(default=1)),
                ('video_required_count', models.PositiveIntegerField(default=1)),
                ('focus_prompt', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_requests', to=settings.AUTH_USER_MODEL)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_requests', to='videos.session')),
                ('space', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_requests', to='videos.space')),
            ],
            options={
                'ordering': ['due_at', '-created_at'],
                'constraints': [
                    models.CheckConstraint(condition=models.Q(sla_hours__gt=0), name='feedback_request_sla_hours_gt_0'),
                    models.CheckConstraint(condition=models.Q(required_reviews__gt=0), name='feedback_request_required_reviews_gt_0'),
                    models.CheckConstraint(condition=models.Q(video_required_count__gte=0), name='feedback_request_video_required_count_gte_0'),
                    models.CheckConstraint(condition=models.Q(video_required_count__lte=models.F('required_reviews')), name='feedback_request_video_required_lte_required_reviews'),
                ],
            },
        ),
        migrations.CreateModel(
            name='FeedbackAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('claimed', 'Claimed'), ('completed', 'Completed'), ('released', 'Released'), ('expired', 'Expired')], default='claimed', max_length=16)),
                ('claimed_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('is_video_review', models.BooleanField(default=False)),
                ('comment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='feedback_assignments', to='videos.comment')),
                ('feedback_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='videos.feedbackrequest')),
                ('reviewer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-claimed_at'],
                'unique_together': {('feedback_request', 'reviewer')},
            },
        ),
    ]
