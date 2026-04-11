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