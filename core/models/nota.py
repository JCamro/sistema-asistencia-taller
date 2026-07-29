from datetime import date

from django.db import models


class Nota(models.Model):
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='notas_admin'
    )
    titulo = models.CharField(max_length=200)
    contenido = models.TextField(blank=True)
    fecha = models.DateField(default=date.today)
    es_recordatorio = models.BooleanField(default=False)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    leida = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-created_at']
        indexes = [
            models.Index(fields=['ciclo', 'leida'], name='notas_ciclo_leida_idx'),
            models.Index(fields=['fecha_vencimiento'], name='notas_fecha_venc_idx'),
        ]

    def __str__(self):
        return self.titulo
