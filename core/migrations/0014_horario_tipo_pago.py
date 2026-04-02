# Generated manually - adds tipo_pago and monto_fijo to Horario

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_matricula_precio_por_sesion'),
    ]

    operations = [
        migrations.AddField(
            model_name='horario',
            name='tipo_pago',
            field=models.CharField(choices=[('dinamico', 'Dinámico'), ('fijo', 'Fijo')], default='dinamico', max_length=10),
        ),
        migrations.AddField(
            model_name='horario',
            name='monto_fijo',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
