from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0018_merge_0014_and_0017'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PracticePlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('timezone', models.CharField(default='America/Los_Angeles', max_length=64)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_practice_plans', to=settings.AUTH_USER_MODEL)),
                ('space', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='practice_plans', to='videos.space')),
            ],
            options={
                'ordering': ['-is_active', 'name', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PracticePlanItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.IntegerField(default=0)),
                ('target_minutes', models.IntegerField(blank=True, null=True)),
                ('target_reps', models.IntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('schedule_json', models.JSONField(blank=True, default=dict)),
                ('exercise', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='practice_plan_items', to='videos.exercise')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='videos.practiceplan')),
                ('reference_clip', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='practice_plan_items', to='videos.exercisereferenceclip')),
            ],
            options={
                'ordering': ['sort_order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='DailyCheckIn',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('status', models.CharField(choices=[('complete', 'Complete'), ('partial', 'Partial'), ('skipped', 'Skipped'), ('missed', 'Missed')], default='partial', max_length=16)),
                ('total_minutes', models.IntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('linked_session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daily_checkins', to='videos.session')),
                ('plan', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='daily_checkins', to='videos.practiceplan')),
                ('space', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_checkins', to='videos.space')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_checkins', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-date', '-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='DailyCheckInItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('completed', models.BooleanField(default=False)),
                ('minutes', models.IntegerField(blank=True, null=True)),
                ('reps', models.IntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('checkin', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='videos.dailycheckin')),
                ('plan_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='checkins', to='videos.practiceplanitem')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.AddConstraint(
            model_name='dailycheckin',
            constraint=models.UniqueConstraint(fields=('space', 'user', 'date'), name='uniq_daily_checkin_space_user_date'),
        ),
    ]
