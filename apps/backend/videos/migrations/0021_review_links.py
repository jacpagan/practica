from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0020_session_reference_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReviewLink',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=40, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('is_active', models.BooleanField(default=True)),
                ('allow_comments', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_accessed_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_review_links', to=settings.AUTH_USER_MODEL)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='review_links', to='videos.session')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='ReviewFeedback',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(blank=True, max_length=120)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('timestamp_seconds', models.IntegerField(blank=True, null=True)),
                ('text', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('review_link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='feedback', to='videos.reviewlink')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='review_feedback', to='videos.session')),
            ],
            options={'ordering': ['timestamp_seconds', 'created_at']},
        ),
    ]

