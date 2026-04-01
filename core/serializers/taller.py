from rest_framework import serializers
from ..models import Taller


class TallerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taller
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class TallerListSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Taller
        fields = ['id', 'ciclo', 'ciclo_nombre', 'nombre', 'tipo', 'tipo_display', 'descripcion', 'activo']
