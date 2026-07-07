from django.db import models


class NotaAlumno(models.Model):
    """
    Notas que un profesor registra para un alumno específico en una clase.
    Una nota por alumno por sesión (profesor + horario + alumno + fecha).
    """
    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='notas_alumno'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='notas_alumno'
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.CASCADE,
        related_name='notas_alumno'
    )
    alumno = models.ForeignKey(
        'Alumno',
        on_delete=models.CASCADE,
        related_name='notas_alumno'
    )
    fecha = models.DateField()
    contenido = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['profesor', 'horario', 'alumno', 'fecha']
        indexes = [
            models.Index(fields=['horario', 'fecha']),
        ]
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.profesor} - {self.alumno} - {self.horario} - {self.fecha}"
