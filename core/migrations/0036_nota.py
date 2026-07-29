# Generated manually for the simplified Nota model

import datetime

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0035_alter_recibo_paquete_aplicado"),
    ]

    operations = [
        migrations.CreateModel(
            name="Nota",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("titulo", models.CharField(max_length=200)),
                ("contenido", models.TextField(blank=True)),
                ("fecha", models.DateField(default=datetime.date.today)),
                ("es_recordatorio", models.BooleanField(default=False)),
                ("fecha_vencimiento", models.DateField(blank=True, null=True)),
                ("leida", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "ciclo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notas_admin",
                        to="core.ciclo",
                    ),
                ),
            ],
            options={
                "ordering": ["-fecha", "-created_at"],
                "indexes": [
                    models.Index(fields=["ciclo", "leida"], name="notas_ciclo_leida_idx"),
                    models.Index(fields=["fecha_vencimiento"], name="notas_fecha_venc_idx"),
                ],
            },
        ),
    ]
