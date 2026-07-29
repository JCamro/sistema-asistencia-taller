from decimal import Decimal

from django.db import models

from ..shared.constants import BASE_PAGO, PORCENTAJE_ADICIONAL, TOPE_MAXIMO


class Configuracion(models.Model):
    ciclo_activo = models.ForeignKey(
        'Ciclo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuracion'
    )
    # Configuración de pago dinámico a profesores (por ciclo)
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='configuracion_pago'
    )
    pago_dinamico_base = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('17.00'),
        verbose_name='Base pago dinámico'
    )
    pago_dinamico_tope = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('35.00'),
        verbose_name='Tope máximo pago dinámico'
    )
    porcentaje_adicional = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.50'),
        verbose_name='Porcentaje adicional'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración'
        verbose_name_plural = 'Configuraciones'
        constraints = [
            models.UniqueConstraint(
                fields=['ciclo'],
                name='unique_ciclo_config',
                condition=models.Q(ciclo__isnull=False)
            )
        ]

    def __str__(self):
        if self.ciclo:
            return f"Configuración ({self.ciclo.nombre})"
        return f"Configuración global (Ciclo activo: {self.ciclo_activo.nombre if self.ciclo_activo else 'None'})"

    @classmethod
    def get_instance(cls):
        """Singleton global (legacy). Mantiene el ciclo activo."""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def get_for_ciclo(cls, ciclo_id):
        """Devuelve la configuración de pago para un ciclo, creándola desde el singleton si no existe."""
        try:
            return cls.objects.get(ciclo_id=ciclo_id)
        except cls.DoesNotExist:
            singleton = cls.get_instance()
            defaults = {
                'pago_dinamico_base': singleton.pago_dinamico_base or BASE_PAGO,
                'pago_dinamico_tope': singleton.pago_dinamico_tope or TOPE_MAXIMO,
                'porcentaje_adicional': singleton.porcentaje_adicional or PORCENTAJE_ADICIONAL,
            }
            # Evitar colisión con la PK 1 del singleton cuando la secuencia no avanzó
            max_id = cls.objects.aggregate(max_id=models.Max('id'))['max_id'] or 0
            return cls.objects.create(id=max_id + 1, ciclo_id=ciclo_id, **defaults)

    @classmethod
    def get_active_config(cls):
        """Devuelve la configuración de pago del ciclo activo."""
        singleton = cls.get_instance()
        if singleton.ciclo_activo_id:
            return cls.get_for_ciclo(singleton.ciclo_activo_id)
        return singleton
