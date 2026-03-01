from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0011_feedback_request_and_assignment'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MultipartSessionUpload',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('initiated', 'Initiated'), ('completed', 'Completed'), ('aborted', 'Aborted'), ('expired', 'Expired')], default='initiated', max_length=16)),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('tags_csv', models.TextField(blank=True)),
                ('duration_seconds', models.IntegerField(blank=True, null=True)),
                ('original_filename', models.CharField(max_length=255)),
                ('content_type', models.CharField(blank=True, max_length=100)),
                ('size_bytes', models.BigIntegerField()),
                ('s3_key', models.CharField(max_length=512)),
                ('s3_upload_id', models.CharField(max_length=256)),
                ('expires_at', models.DateTimeField()),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='multipart_upload_records', to='videos.session')),
                ('space', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='multipart_uploads', to='videos.space')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='multipart_uploads', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='multipartsessionupload',
            index=models.Index(fields=['user', 'status'], name='videos_multi_user_id_62daca_idx'),
        ),
        migrations.AddIndex(
            model_name='multipartsessionupload',
            index=models.Index(fields=['expires_at'], name='videos_multi_expires_dbb13d_idx'),
        ),
        migrations.AddConstraint(
            model_name='multipartsessionupload',
            constraint=models.UniqueConstraint(fields=('s3_key', 's3_upload_id'), name='multipart_upload_s3_key_upload_id_uniq'),
        ),
    ]
