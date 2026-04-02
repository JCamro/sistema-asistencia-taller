from rest_framework import serializers
from ..models import PrecioPaquete


class PrecioPaqueteSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True, default=None)
    
    class Meta:
        model = PrecioPaquete
        fields = ['id', 'ciclo', 'ciclo_nombre', 'tipo_taller', 'tipo_paquete', 
                  'cantidad_clases', 'cantidad_clases_secundaria', 'precio_total', 'precio_por_sesion', 'activo']