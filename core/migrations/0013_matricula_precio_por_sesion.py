# Generated manually - adds precio_por_sesion field to Matricula

from decimal import Decimal
from django.db import migrations, models


def backfill_precio_por_sesion(apps, schema_editor):
    """Recalcula precio_por_sesion para todas las matrículas existentes."""
    Matricula = apps.get_model('core', 'Matricula')
    for m in Matricula.objects.all():
        if m.sesiones_contratadas > 0:
            m.precio_por_sesion = m.precio_total / m.sesiones_contratadas
        else:
            m.precio_por_sesion = Decimal('0.00')
        m.save(update_fields=['precio_por_sesion'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_add_cantidad_clases_secundaria'),
    ]

    operations = [
        # 1. Agregar campo con default temporal (requerido para SQLite)
        migrations.AddField(
            model_name='matricula',
            name='precio_por_sesion',
            field=models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00')),
            preserve_default=False,
        ),
        # 2. Backfill: recalcular precio_por_sesion para matrículas existentes
        migrations.RunPython(backfill_precio_por_sesion, migrations.RunPython.noop),
    ]
