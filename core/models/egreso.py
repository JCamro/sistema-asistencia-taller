from django.db import models


class Egreso(models.Model):
    TIPO_EGRESO = [
        ('gasto_taller', 'Gasto del Taller'),
        ('pago_profesor', 'Pago a Profesor'),
        ('gasto_personal', 'Gasto de Personal'),
    ]
    
    METODO_PAGO = [
        ('efectivo', 'Efectivo'),
        ('transferencia', 'Transferencia'),
        ('yape', 'Yape'),
        ('plin', 'Plin'),
    ]
    
    ESTADO = [
        ('pendiente', 'Pendiente'),
        ('cancelado', 'Cancelado'),
    ]
    
    tipo = models.CharField(max_length=20, choices=TIPO_EGRESO)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.CharField(max_length=255, blank=True)
    fecha = models.DateField()
    metodo_pago = models.CharField(max_length=20, choices=METODO_PAGO)
    categoria = models.CharField(max_length=50, blank=True)  # Solo para gasto_taller
    beneficiario = models.CharField(max_length=150, blank=True)
    profesor = models.ForeignKey(
        'Profesor', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='egresos'
    )
    ciclo = models.ForeignKey(
        'Ciclo', 
        on_delete=models.CASCADE, 
        related_name='egresos'
    )
    estado = models.CharField(max_length=20, choices=ESTADO, default='pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-id']

    def __str__(self):
        return f"{self.get_tipo_display()}: S/. {self.monto} - {self.beneficiario or self.descripcion[:30]}"
