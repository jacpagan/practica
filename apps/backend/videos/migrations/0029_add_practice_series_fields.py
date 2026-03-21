from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0028_rename_videos_multi_user_id_62daca_idx_videos_mult_user_id_c16210_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='multipartsessionupload',
            name='practice_series',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='session',
            name='practice_series',
            field=models.CharField(blank=True, db_index=True, max_length=200),
        ),
    ]
