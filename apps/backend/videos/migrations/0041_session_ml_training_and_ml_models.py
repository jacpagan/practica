from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0040_multipartsessionupload_client_upload_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='ml_training_consent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='session',
            name='ml_training_consent_revocation_source',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='session',
            name='ml_training_consent_revoked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='session',
            name='ml_training_consent_source',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='session',
            name='ml_training_enabled',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.CreateModel(
            name='MLDatasetSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot_version', models.CharField(db_index=True, max_length=32)),
                ('session_ids_json', models.JSONField(blank=True, default=list)),
                ('manifest_json', models.JSONField(blank=True, default=dict)),
                ('row_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ml_dataset_snapshots', to='auth.user')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.CreateModel(
            name='MLModelSuggestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('model_name', models.CharField(db_index=True, max_length=64)),
                ('model_version', models.CharField(db_index=True, max_length=32)),
                ('predicted_thread_label', models.CharField(blank=True, max_length=200)),
                ('predicted_label_choices_json', models.JSONField(blank=True, default=list)),
                ('confidence_json', models.JSONField(blank=True, default=dict)),
                ('explanation_json', models.JSONField(blank=True, default=dict)),
                ('decision', models.CharField(blank=True, choices=[('accepted', 'Accepted'), ('rejected', 'Rejected'), ('edited', 'Edited')], max_length=16)),
                ('resolved_thread_label', models.CharField(blank=True, max_length=200)),
                ('resolved_label_choices_json', models.JSONField(blank=True, default=list)),
                ('note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ml_model_suggestions', to='auth.user')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ml_suggestions', to='videos.session')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='mldatasetsnapshot',
            index=models.Index(fields=['snapshot_version', 'created_at'], name='mlsnap_ver_created_idx'),
        ),
        migrations.AddIndex(
            model_name='mlmodelsuggestion',
            index=models.Index(fields=['session', 'created_at'], name='mlsugg_session_created_idx'),
        ),
        migrations.AddIndex(
            model_name='mlmodelsuggestion',
            index=models.Index(fields=['model_name', 'model_version'], name='mlsugg_model_version_idx'),
        ),
    ]
