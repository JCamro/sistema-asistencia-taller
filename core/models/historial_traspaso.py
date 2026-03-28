from django.db import models


class HistorialTraspaso(models.Model):
    matricula_origen = models.ForeignKey(
        'Matricula',
        on_delete=models.CASCADE,
        related_name='traspasos_origen'
    )
    matricula_destino = models.ForeignKey(
        'Matricula',
        on_delete=models.CASCADE,
        related_name='traspasos_destino'
    )
    alumno_origen = models.ForeignKey(
        'Alumno',
        on_delete=models.CASCADE,
        related_name='traspasos_origen'
    )
    alumno_destino = models.ForeignKey(
        'Alumno',
        on_delete=models.CASCADE,
        related_name='traspasos_destino'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='traspasos'
    )
    taller = models.ForeignKey(
        'Taller',
        on_delete=models.CASCADE,
        related_name='traspasos'
    )
    fecha_traspaso = models.DateTimeField(auto_now_add=True)
    asistencias_transferidas = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-fecha_traspaso']

    def __str__(self):
        return f"Traspaso: {self.alumno_origen} -> {self.alumno_destino} ({self.taller.nombre})"
