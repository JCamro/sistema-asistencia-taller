from django.db import models


class Ciclo(models.Model):
    TIPO_CICLO = [
        ('anual', 'Anual'),
        ('verano', 'Verano'),
        ('otro', 'Otro'),
    ]

    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=TIPO_CICLO, default='anual')
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_inicio']

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"
