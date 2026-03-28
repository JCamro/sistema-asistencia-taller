from rest_framework import serializers
from ..models import Ciclo


class CicloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ciclo
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class CicloListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ciclo
        fields = ['id', 'nombre', 'tipo', 'fecha_inicio', 'fecha_fin', 'activo']
