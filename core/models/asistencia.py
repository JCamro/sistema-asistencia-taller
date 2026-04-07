from django.db import models


class Asistencia(models.Model):
    ESTADO = [
        ('asistio', 'Asistió'),
        ('falta', 'Falta'),
        ('falta_grave', 'Falta Grave'),
    ]

    matricula = models.ForeignKey(
        'Matricula',
        on_delete=models.CASCADE,
        related_name='asistencias',
        null=True,
        blank=True
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.CASCADE,
        related_name='asistencias'
    )
    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='asistencias'
    )
    fecha = models.DateField(db_index=True)
    hora = models.TimeField()
    estado = models.CharField(max_length=20, choices=ESTADO, default='asistio', db_index=True)
    observacion = models.TextField(blank=True)
    es_recuperacion = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-hora']
        unique_together = ['matricula', 'horario', 'fecha']
        indexes = [
            models.Index(fields=['horario', 'fecha'], name='asistencia_horario_fecha_idx'),
        ]

    def __str__(self):
        return f"{self.matricula.alumno if self.matricula else 'Sin matrícula'} - {self.horario} - {self.fecha} ({self.estado})"
