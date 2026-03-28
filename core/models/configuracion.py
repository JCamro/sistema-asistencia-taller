from django.db import models


class Configuracion(models.Model):
    ciclo_activo = models.ForeignKey(
        'Ciclo',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuracion'
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
