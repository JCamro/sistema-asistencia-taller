from rest_framework import serializers
from ..models import Alumno
from ..validators import alphanumeric_validator
from ..serializer_helpers import get_nombre_completo


class AlumnoSerializer(serializers.ModelSerializer):
    edad = serializers.IntegerField(read_only=True)
    dni = serializers.CharField(
        max_length=15,
        min_length=1,
        validators=[alphanumeric_validator]
    )

    class Meta:
        model = Alumno
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class AlumnoListSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    nombre_completo = serializers.SerializerMethodField()
    edad = serializers.IntegerField(read_only=True)
    dni = serializers.CharField(
        max_length=15,
        min_length=1,
        validators=[alphanumeric_validator]
    )

    class Meta:
        model = Alumno
        fields = ['id', 'ciclo', 'ciclo_nombre', 'nombre', 'apellido', 'nombre_completo', 'dni', 'telefono', 'email', 'fecha_nacimiento', 'edad', 'activo', 'created_at', 'updated_at']

    def get_nombre_completo(self, obj):
        return get_nombre_completo(obj)
