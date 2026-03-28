from rest_framework import serializers
from ..models import PagoProfesor


class PagoProfesorSerializer(serializers.ModelSerializer):
    class Meta:
        model = PagoProfesor
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class PagoProfesorListSerializer(serializers.ModelSerializer):
    profesor_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)

    class Meta:
        model = PagoProfesor
        fields = [
            'id', 'profesor', 'profesor_nombre', 'ciclo', 'ciclo_nombre',
            'horas_calculadas', 'monto_calculado', 'monto_final',
            'fecha_pago', 'estado', 'observacion'
        ]

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"
