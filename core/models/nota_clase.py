from django.db import models


class NotaClase(models.Model):
    """
    Notas que un profesor registra para una clase específica.
    Una nota es por sesión (profesor + horario + fecha), no por alumno.
    """
    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='notas_clase'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='notas_clase'
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.CASCADE,
        related_name='notas_clase'
    )
    fecha = models.DateField()
    contenido = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['profesor', 'horario', 'fecha']
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.profesor} - {self.horario} - {self.fecha}"
