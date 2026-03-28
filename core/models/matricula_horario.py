from django.db import models


class MatriculaHorario(models.Model):
    matricula = models.ForeignKey(
        'Matricula',
        on_delete=models.CASCADE,
        related_name='horarios'
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.CASCADE,
        related_name='matricula_horarios'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['matricula', 'horario']

    def __str__(self):
        return f"{self.matricula} - {self.horario}"
