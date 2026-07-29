from django.db import models


class PrecioPaquete(models.Model):
    TIPO_TALLER_CHOICES = [
        ('instrumento', 'Instrumento'),
        ('taller', 'Taller'),
    ]

    TIPO_PAQUETE_CHOICES = [
        ('individual', 'Individual'),
        ('combo_musical', 'Combo Musical (2 Instrumentos)'),
        ('mixto', 'Mixto (Instrumento + Taller)'),
        ('intensivo', 'Intensivo'),
    ]

    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='precios_paquete',
        verbose_name='Ciclo'
    )
    tipo_taller = models.CharField(
        max_length=20,
        choices=TIPO_TALLER_CHOICES,
        verbose_name='Tipo de Taller'
    )
    tipo_paquete = models.CharField(
        max_length=20,
        choices=TIPO_PAQUETE_CHOICES,
        default='individual',
        verbose_name='Tipo de Paquete'
    )
    cantidad_clases = models.IntegerField(
        verbose_name='Cantidad de Clases'
    )
    cantidad_clases_secundaria = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Cantidad de Clases Secundaria',
        help_text='Solo para combo_musical y mixto. Ej: combo 12+8 → principal=12, secundaria=8'
    )
    precio_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Precio Total'
    )
    precio_por_sesion = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Precio por Sesión'
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['ciclo', 'tipo_paquete', 'tipo_taller', 'cantidad_clases']
        unique_together = ['ciclo', 'tipo_taller', 'tipo_paquete', 'cantidad_clases', 'cantidad_clases_secundaria']
        verbose_name = 'Precio de Paquete'
        verbose_name_plural = 'Precios de Paquetes'

    def __str__(self):
        ciclo_nombre = self.ciclo.nombre if self.ciclo else 'Global'
        clases = str(self.cantidad_clases)
        if self.cantidad_clases_secundaria:
            clases = f"{self.cantidad_clases}+{self.cantidad_clases_secundaria}"
        return f"{ciclo_nombre} - {self.get_tipo_paquete_display()} - {self.get_tipo_taller_display()} - {clases} clases: S/. {self.precio_total}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.cantidad_clases < 1:
            raise ValidationError({'cantidad_clases': 'La cantidad de clases debe ser al menos 1.'})
        if self.cantidad_clases_secundaria is not None and self.cantidad_clases_secundaria < 1:
            raise ValidationError({'cantidad_clases_secundaria': 'La cantidad de clases secundaria debe ser al menos 1.'})

    @classmethod
    def get_precio_individual(cls, tipo_taller, cantidad_clases, ciclo_id=None):
        """Obtiene precio para un paquete individual. Busca primero por ciclo, luego global."""
        # Try cycle-specific first
        if ciclo_id:
            precio = cls.objects.filter(
                ciclo_id=ciclo_id,
                tipo_taller=tipo_taller,
                tipo_paquete='individual',
                cantidad_clases=cantidad_clases,
                activo=True
            ).first()
            if precio:
                return {
                    'precio_total': float(precio.precio_total),
                    'precio_por_sesion': float(precio.precio_por_sesion)
                }
        
        # Fallback to global (ciclo=None)
        precio = cls.objects.filter(
            ciclo__isnull=True,
            tipo_taller=tipo_taller,
            tipo_paquete='individual',
            cantidad_clases=cantidad_clases,
            activo=True
        ).first()
        if precio:
            return {
                'precio_total': float(precio.precio_total),
                'precio_por_sesion': float(precio.precio_por_sesion)
            }
        return None

