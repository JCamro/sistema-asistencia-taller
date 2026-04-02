from django.db import models


class Matricula(models.Model):
    METODO_PAGO = [
        ('efectivo', 'Efectivo'),
        ('transferencia', 'Transferencia'),
        ('tarjeta', 'Tarjeta'),
        ('otro', 'Otro'),
    ]

    alumno = models.ForeignKey(
        'Alumno',
        on_delete=models.CASCADE,
        related_name='matriculas'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='matriculas'
    )
    taller = models.ForeignKey(
        'Taller',
        on_delete=models.CASCADE,
        related_name='matriculas'
    )
    sesiones_contratadas = models.PositiveIntegerField()
    precio_total = models.DecimalField(max_digits=10, decimal_places=2)
    precio_por_sesion = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(max_length=20, choices=METODO_PAGO, default='efectivo')
    observaciones = models.TextField(blank=True)
    fecha_matricula = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)
    concluida = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_matricula']

    def __str__(self):
        return f"{self.alumno} - {self.taller.nombre} ({self.sesiones_contratadas} sesiones)"

    @property
    def sesiones_consumidas(self):
        return self.asistencias.filter(estado__in=['asistio', 'falta_grave']).count()

    @property
    def sesiones_disponibles(self):
        return max(0, self.sesiones_contratadas - self.sesiones_consumidas)


