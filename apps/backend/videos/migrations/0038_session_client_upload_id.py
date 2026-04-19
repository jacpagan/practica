from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('videos', '0037_producteventlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='client_upload_id',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
        migrations.AddConstraint(
            model_name='session',
            constraint=models.UniqueConstraint(
                condition=~Q(client_upload_id=''),
                fields=('user', 'client_upload_id'),
                name='session_user_client_upload_uniq',
            ),
        ),
    ]
