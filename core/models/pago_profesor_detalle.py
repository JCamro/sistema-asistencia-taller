from django.db import models


class PagoProfesorDetalle(models.Model):
    pago_profesor = models.ForeignKey(
        'PagoProfesor',
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.CASCADE,
        related_name='pagos_detalle'
    )
    fecha = models.DateField()
    num_alumnos = models.PositiveIntegerField(default=0)
    valor_generado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_base = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_adicional = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_profesor = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ganancia_taller = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha', 'horario__dia_semana', 'horario__hora_inicio']
        unique_together = ['pago_profesor', 'horario', 'fecha']

    def __str__(self):
        return f"{self.pago_profesor.profesor} - {self.fecha} - S/. {self.monto_profesor}"
