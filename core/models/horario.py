from django.db import models


class Horario(models.Model):
    DIA_SEMANA = [
        (0, 'Lunes'),
        (1, 'Martes'),
        (2, 'Miércoles'),
        (3, 'Jueves'),
        (4, 'Viernes'),
        (5, 'Sábado'),
        (6, 'Domingo'),
    ]

    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='horarios'
    )
    taller = models.ForeignKey(
        'Taller',
        on_delete=models.CASCADE,
        related_name='horarios'
    )
    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='horarios'
    )
    dia_semana = models.IntegerField(choices=DIA_SEMANA)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    cupo_maximo = models.PositiveIntegerField(default=10)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['dia_semana', 'hora_inicio']
        unique_together = ['ciclo', 'taller', 'profesor', 'dia_semana', 'hora_inicio']

    def __str__(self):
        return f"{self.taller.nombre} - {self.get_dia_semana_display()} {self.hora_inicio}-{self.hora_fin}"

    @property
    def cupo_disponible(self):
        from django.db.models import Count
        from django.db.models import Q
        
        ocupacion = self.matricula_horarios.filter(
            matricula__activo=True,
            matricula__concluida=False
        ).count()
        
        return max(0, self.cupo_maximo - ocupacion)
