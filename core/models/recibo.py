from django.db import models


class Recibo(models.Model):
    ESTADO = [
        ('pendiente', 'Pendiente'),
        ('pagado', 'Pagado'),
        ('anulado', 'Anulado'),
    ]

    numero = models.CharField(max_length=20, unique=True)
    alumno = models.ForeignKey(
        'Alumno',
        on_delete=models.CASCADE,
        related_name='recibos'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='recibos'
    )
    fecha_emision = models.DateField()
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADO, default='pendiente')
    observacion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_emision']

    def __str__(self):
        return f"Recibo {self.numero} - {self.alumno} - S/. {self.monto_total}"

    @property
    def saldo_pendiente(self):
        return max(0, self.monto_total - self.monto_pagado)
