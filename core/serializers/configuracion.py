from rest_framework import serializers
from ..models import Configuracion


class ConfiguracionSerializer(serializers.ModelSerializer):
    ciclo_activo_nombre = serializers.CharField(source='ciclo_activo.nombre', read_only=True)
    
    class Meta:
        model = Configuracion
        fields = ['id', 'ciclo_activo', 'ciclo_activo_nombre', 'updated_at']
        read_only_fields = ['id', 'updated_at']
