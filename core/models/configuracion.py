from decimal import Decimal

from django.db import models


class Configuracion(models.Model):
    ciclo_activo = models.ForeignKey(
        'Ciclo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuracion'
    )
    # Configuración de pago dinámico a profesores
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración'
        verbose_name_plural = 'Configuraciones'

    def __str__(self):
        return f"Configuración (Ciclo activo: {self.ciclo_activo.nombre if self.ciclo_activo else 'None'})"

    @classmethod
    def get_instance(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
