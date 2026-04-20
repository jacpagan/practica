from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0039_rename_videos_multi_user_id_62daca_idx_videos_mult_user_id_c16210_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='multipartsessionupload',
            name='client_upload_id',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddConstraint(
            model_name='multipartsessionupload',
            constraint=models.UniqueConstraint(
                condition=~Q(client_upload_id=''),
                fields=('user', 'client_upload_id'),
                name='multipart_upload_user_client_upload_uniq',
            ),
        ),
    ]
