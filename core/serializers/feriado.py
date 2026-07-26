from rest_framework import serializers
from ..models import Feriado


class FeriadoSerializer(serializers.ModelSerializer):
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    horario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Feriado
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_horario_nombre(self, obj):
        if obj.horario:
            return f"{obj.horario.get_dia_semana_display()} {obj.horario.hora_inicio}-{obj.horario.hora_fin}"
        return None


class FeriadoListSerializer(serializers.ModelSerializer):
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    horario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Feriado
        fields = [
            'id', 'ciclo', 'fecha', 'motivo',
            'taller', 'taller_nombre',
            'horario', 'horario_nombre',
            'created_at', 'updated_at'
        ]

    def get_horario_nombre(self, obj):
        if obj.horario:
            return f"{obj.horario.get_dia_semana_display()} {obj.horario.hora_inicio}-{obj.horario.hora_fin}"
        return None
