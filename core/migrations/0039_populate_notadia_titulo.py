from django.db import migrations


def populate_titulo(apps, schema_editor):
    NotaDia = apps.get_model('core', 'NotaDia')
    for nota in NotaDia.objects.all():
        nota.titulo = f"Nota del {nota.fecha}"
        nota.save(update_fields=['titulo'])


def reverse_populate(apps, schema_editor):
    NotaDia = apps.get_model('core', 'NotaDia')
    NotaDia.objects.all().update(titulo='')


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0038_alter_notadia_options_alter_notadia_unique_together_and_more"),
    ]

    operations = [
        migrations.RunPython(populate_titulo, reverse_populate),
    ]
