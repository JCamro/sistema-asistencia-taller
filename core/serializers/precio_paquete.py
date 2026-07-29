from rest_framework import serializers
from ..models import PrecioPaquete


class PrecioPaqueteSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True, default=None)

    class Meta:
        model = PrecioPaquete
        fields = ['id', 'ciclo', 'ciclo_nombre', 'tipo_taller', 'tipo_paquete', 
                  'cantidad_clases', 'cantidad_clases_secundaria', 'precio_total', 'precio_por_sesion', 'activo']

    def validate_cantidad_clases(self, value):
        if value < 1:
            raise serializers.ValidationError('La cantidad de clases debe ser al menos 1.')
        return value

    def validate_cantidad_clases_secundaria(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError('La cantidad de clases secundaria debe ser al menos 1.')
        return value

    def validate(self, attrs):
        cantidad_clases = attrs.get('cantidad_clases', self.instance.cantidad_clases if self.instance else 0)
        secundaria = attrs.get('cantidad_clases_secundaria', self.instance.cantidad_clases_secundaria if self.instance else None)
        precio_total = attrs.get('precio_total', self.instance.precio_total if self.instance else None)
        precio_por_sesion = attrs.get('precio_por_sesion', self.instance.precio_por_sesion if self.instance else None)

        total_clases = cantidad_clases + (secundaria or 0)
        if total_clases > 0 and precio_total is not None and precio_por_sesion is not None:
            esperado = float(precio_total) / total_clases
            if abs(float(precio_por_sesion) - esperado) > 0.01:
                raise serializers.ValidationError({
                    'precio_por_sesion': f'El precio por sesión debe ser aproximadamente {esperado:.2f}.'
                })
        return attrs