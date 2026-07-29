from django.db import models


class Recibo(models.Model):
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

    METODO_PAGO = [
        ('efectivo', 'Efectivo'),
        ('transferencia', 'Transferencia'),
        ('tarjeta', 'Tarjeta'),
        ('yape', 'Yape'),
        ('plin', 'Plin'),
        ('otro', 'Otro'),
    ]

    ESTADO = [
        ('pendiente', 'Pendiente'),
        ('pagado', 'Pagado'),
        ('anulado', 'Anulado'),
    ]

    numero = models.CharField(max_length=20, unique=True)
    alumno = models.ForeignKey(
        'Alumno',
        on_delete=models.PROTECT,
        related_name='recibos',
        null=True,
        blank=True,
        verbose_name='Alumno principal (opcional)'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.PROTECT,
        related_name='recibos'
    )
    fecha_emision = models.DateField(db_index=True)
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
    metodo_pago = models.CharField(max_length=20, choices=METODO_PAGO, default='efectivo')
    estado = models.CharField(max_length=20, choices=ESTADO, default='pendiente')
    observacion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        if self.alumno_id:  # use _id to avoid extra query
            return f"Recibo {self.numero} - {self.alumno.nombre} {self.alumno.apellido} - S/. {self.monto_total}"
        # Use prefetched relation if already loaded (avoids query in admin)
        if hasattr(self, '_prefetched_objects_cache') and 'matriculas' in self._prefetched_objects_cache:
            nombres = []
            for rm in self.matriculas.all():
                alias = getattr(rm.matricula.alumno, 'nombre', '')
                if alias and alias not in nombres:
                    nombres.append(alias)
            return f"Recibo {self.numero} - {', '.join(nombres[:2])} - S/. {self.monto_total}"
        return f"Recibo {self.numero} - S/. {self.monto_total}"

    @property
    def saldo_pendiente(self):
        return max(0, self.monto_total - self.monto_pagado)

    @property
    def porcentaje_descuento(self):
        if self.monto_bruto > 0:
            return round((self.descuento / self.monto_bruto) * 100, 1)
        return 0
