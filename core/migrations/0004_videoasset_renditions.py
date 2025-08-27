from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0003_remove_videoasset_core_videoa_is_vali_a570d9_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='videoasset',
            name='renditions',
            field=models.JSONField(blank=True, default=dict, help_text='Mapping of quality labels to rendition URLs'),
        ),
    ]
