from django.db import models
from datetime import date


class Profesor(models.Model):
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='profesores'
    )
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    dni = models.CharField(max_length=15)
    telefono = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    activo = models.BooleanField(default=True)
    es_gerente = models.BooleanField(default=False)
    observaciones = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['apellido', 'nombre']
        unique_together = ['ciclo', 'dni']

    def __str__(self):
        return f"{self.apellido}, {self.nombre}"

    @property
    def edad(self):
        if not self.fecha_nacimiento:
            return None
        from django.utils import timezone
        today = timezone.now().date()
        edad = today.year - self.fecha_nacimiento.year
        if (today.month, today.day) < (self.fecha_nacimiento.month, self.fecha_nacimiento.day):
            edad -= 1
        return edad
