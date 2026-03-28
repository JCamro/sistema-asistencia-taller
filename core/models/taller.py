from django.db import models


class Taller(models.Model):
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='talleres'
    )
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nombre']
        unique_together = ['ciclo', 'nombre']

    def __str__(self):
        return self.nombre
