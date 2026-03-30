from rest_framework import serializers
from ..models import PagoProfesor, PagoProfesorDetalle


class PagoProfesorDetalleSerializer(serializers.ModelSerializer):
    horario_info = serializers.SerializerMethodField()

    class Meta:
        model = PagoProfesorDetalle
        fields = [
            'id', 'horario', 'horario_info', 'fecha',
            'num_alumnos', 'valor_generado', 'monto_base',
            'monto_adicional', 'monto_profesor', 'ganancia_taller'
        ]

    def get_horario_info(self, obj):
        return f"{obj.horario.taller.nombre} - {obj.horario.get_dia_semana_display()} {obj.horario.hora_inicio.strftime('%H:%M')}-{obj.horario.hora_fin.strftime('%H:%M')}"


class PagoProfesorSerializer(serializers.ModelSerializer):
    detalles = PagoProfesorDetalleSerializer(many=True, read_only=True)

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
            'fecha_inicio', 'fecha_fin', 'total_alumnos_asistencias',
            'ganancia_taller', 'fecha_pago', 'estado', 'observacion'
        ]

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"
