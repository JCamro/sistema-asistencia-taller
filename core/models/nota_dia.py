from django.db import models


class NotaDia(models.Model):
    """
    Notas generales del día que un profesor registra.
    Múltiples notas por día, sin dependencia de horario/taller.
    """
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='notas_generales'
    )
    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='notas_generales'
    )
    fecha = models.DateField()
    titulo = models.CharField(max_length=200, default='')  # populated via data migration
    contenido = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['ciclo', 'fecha']),
            models.Index(fields=['profesor', 'fecha']),
        ]
        ordering = ['-fecha', '-created_at']

    def __str__(self):
        return f"{self.titulo} - {self.fecha}"
