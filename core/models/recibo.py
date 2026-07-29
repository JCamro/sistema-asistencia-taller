from django.db import models


class Recibo(models.Model):
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
        max_length=50,
        blank=True,
        default='',
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

    @property
    def paquete_label(self) -> str:
        """Etiqueta legible para los paquetes aplicados (soporta múltiples)."""
        value = self.paquete_aplicado
        if not value or value == 'individual':
            return 'Individual'
        labels = []
        for v in value.split(','):
            parts = v.split('_')
            if parts[0] == 'combo' and len(parts) >= 2 and parts[1] == 'musical':
                numeros = parts[2:]
                labels.append('Combo Musical (' + '+'.join(numeros) + ')' if numeros else 'Combo Musical')
            elif parts[0] == 'mixto':
                numeros = parts[1:]
                labels.append('Mixto (' + '+'.join(numeros) + ')' if numeros else 'Mixto')
            elif parts[0] == 'intensivo':
                labels.append('Intensivo ' + ' '.join(p.title() for p in parts[1:]) if len(parts) > 1 else 'Intensivo')
            else:
                labels.append(v)
        return ', '.join(labels)
