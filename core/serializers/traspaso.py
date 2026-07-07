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

