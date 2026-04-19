from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0036_reviewerinvite_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductEventLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_name', models.CharField(db_index=True, max_length=80)),
                ('path', models.CharField(blank=True, max_length=512)),
                ('is_authenticated', models.BooleanField(default=False)),
                ('client_trace_id', models.CharField(blank=True, max_length=128)),
                ('extra_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='product_event_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['event_name', 'created_at'], name='videos_produ_event_n_2ae9b2_idx')],
            },
        ),
    ]
