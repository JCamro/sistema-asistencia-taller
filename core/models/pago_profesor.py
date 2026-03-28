from django.db import models


class PagoProfesor(models.Model):
    ESTADO = [
        ('calculado', 'Calculado'),
        ('pagado', 'Pagado'),
        ('anulado', 'Anulado'),
    ]

    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='pagos'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='pagos_profesores'
    )
    horas_calculadas = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_calculado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_final = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fecha_pago = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO, default='calculado')
    observacion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['profesor', 'ciclo']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.profesor} - {self.ciclo} - S/. {self.monto_final}"
