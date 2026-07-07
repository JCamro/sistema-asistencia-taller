from django.db import models


class NotaDia(models.Model):
    """
    Notas generales del día que un profesor registra.
    Una nota por día por profesor (no asociada a un horario específico).
    """
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='notas_dia'
    )
    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='notas_dia'
    )
    fecha = models.DateField()
    contenido = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['ciclo', 'profesor', 'fecha']
        indexes = [
            models.Index(fields=['ciclo', 'fecha']),
        ]
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.profesor} - {self.fecha}"
