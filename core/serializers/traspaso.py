from rest_framework import serializers
from ..models import Alumno, Matricula, HistorialTraspaso


class TraspasoSerializer(serializers.Serializer):
    alumno_destino_id = serializers.IntegerField()

    def validate_alumno_destino_id(self, value):
        try:
            alumno = Alumno.objects.get(id=value, activo=True)
        except Alumno.DoesNotExist:
            raise serializers.ValidationError('El alumno destino no existe o no está activo.')
        return value


class HistorialTraspasoSerializer(serializers.ModelSerializer):
    alumno_origen_nombre = serializers.SerializerMethodField()
    alumno_destino_nombre = serializers.SerializerMethodField()
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)

    class Meta:
        model = HistorialTraspaso
        fields = [
            'id', 'matricula_origen', 'matricula_destino',
            'alumno_origen', 'alumno_origen_nombre',
            'alumno_destino', 'alumno_destino_nombre',
            'ciclo', 'taller', 'taller_nombre',
            'fecha_traspaso', 'asistencias_transferidas',
        ]

    def get_alumno_origen_nombre(self, obj):
        return f"{obj.alumno_origen.apellido}, {obj.alumno_origen.nombre}"

    def get_alumno_destino_nombre(self, obj):
        return f"{obj.alumno_destino.apellido}, {obj.alumno_destino.nombre}"
