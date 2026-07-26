from django.db import models
from django.db.models import Q


class Feriado(models.Model):
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='feriados'
    )
    fecha = models.DateField()
    motivo = models.CharField(max_length=200)
    taller = models.ForeignKey(
        'Taller',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='feriados'
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='feriados'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha']
        constraints = [
            models.UniqueConstraint(
                fields=['ciclo', 'fecha'],
                name='unique_global_feriado',
                condition=Q(taller__isnull=True, horario__isnull=True),
            ),
            models.UniqueConstraint(
                fields=['ciclo', 'fecha', 'taller'],
                name='unique_taller_feriado',
                condition=Q(taller__isnull=False, horario__isnull=True),
            ),
            models.UniqueConstraint(
                fields=['ciclo', 'fecha', 'horario'],
                name='unique_horario_feriado',
                condition=Q(horario__isnull=False),
            ),
        ]

    def __str__(self):
        return f"{self.fecha} - {self.motivo}"
