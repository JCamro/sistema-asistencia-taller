from django.db import models


class Taller(models.Model):
    TIPO_CHOICES = [
        ('instrumento', 'Instrumento'),
        ('taller', 'Taller'),
    ]

    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='talleres'
    )
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='taller',
        verbose_name='Tipo'
    )
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nombre']
        unique_together = ['ciclo', 'nombre']

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()})"
