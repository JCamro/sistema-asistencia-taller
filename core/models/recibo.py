from django.db import models


class Recibo(models.Model):
    ESTADO = [
        ('pendiente', 'Pendiente'),
        ('pagado', 'Pagado'),
        ('anulado', 'Anulado'),
    ]

    PAQUETE_CHOICES = [
        ('individual', 'Individual'),
        ('combo_musical_12', 'Combo Musical 12+12'),
        ('combo_musical_8', 'Combo Musical 8+8'),
        ('combo_musical_12_8', 'Combo Musical 12+8'),
        ('combo_musical_8_8', 'Combo Musical 8+8 (otro)'),
        ('combo_musical_12_12', 'Combo Musical 12+12 (otro)'),
        ('mixto_12', 'Mixto 12+12'),
        ('mixto_8', 'Mixto 8+8'),
        ('mixto_12_8', 'Mixto 12+8'),
        ('mixto_8_8', 'Mixto 8+8 (otro)'),
        ('mixto_12_12', 'Mixto 12+12 (otro)'),
        ('intensivo_instrumento', 'Intensivo Instrumento'),
        ('intensivo_taller', 'Intensivo Taller'),
    ]

    numero = models.CharField(max_length=20, unique=True)
    alumno = models.ForeignKey(
        'Alumno',
        on_delete=models.CASCADE,
        related_name='recibos',
        null=True,
        blank=True,
        verbose_name='Alumno principal (opcional)'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='recibos'
    )
    fecha_emision = models.DateField()
    monto_bruto = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Monto Bruto (sin descuento)'
    )
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    descuento = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Descuento aplicado'
    )
    paquete_aplicado = models.CharField(
        max_length=30,
        choices=PAQUETE_CHOICES,
        default='individual',
        verbose_name='Paquete promocional aplicado'
    )
    precio_editado = models.BooleanField(
        default=False,
        verbose_name='¿Precio fue editado manualmente?'
    )
    estado = models.CharField(max_length=20, choices=ESTADO, default='pendiente')
    observacion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        if self.alumno:
            return f"Recibo {self.numero} - {self.alumno} - S/. {self.monto_total}"
        # Obtener nombres de alumnos de las matrículas
        try:
            alumnos = self.matriculas.values_list('matricula__alumno__nombre', flat=True).distinct()
            nombres = ", ".join(alumnos[:2])
            if len(alumnos) > 2:
                nombres += f" y {len(alumnos) - 2} más"
            return f"Recibo {self.numero} - {nombres} - S/. {self.monto_total}"
        except Exception:
            return f"Recibo {self.numero} - S/. {self.monto_total}"

    @property
    def saldo_pendiente(self):
        return max(0, self.monto_total - self.monto_pagado)

    @property
    def porcentaje_descuento(self):
        if self.monto_bruto > 0:
            return round((self.descuento / self.monto_bruto) * 100, 1)
        return 0
