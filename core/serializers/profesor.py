from rest_framework import serializers
from django.core.validators import RegexValidator
from ..models import Profesor


# Validator: 1-15 alphanumeric characters
alphanumeric_validator = RegexValidator(
    regex=r'^[A-Za-z0-9]{1,15}$',
    message='El DNI debe contener entre 1 y 15 caracteres alfanuméricos.'
)


class ProfesorSerializer(serializers.ModelSerializer):
    edad = serializers.IntegerField(read_only=True)
    dni = serializers.CharField(
        max_length=15,
        min_length=1,
        validators=[alphanumeric_validator]
    )

    class Meta:
        model = Profesor
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class ProfesorListSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    nombre_completo = serializers.SerializerMethodField()
    edad = serializers.IntegerField(read_only=True)
    dni = serializers.CharField(
        max_length=15,
        min_length=1,
        validators=[alphanumeric_validator]
    )

    class Meta:
        model = Profesor
        fields = ['id', 'ciclo', 'ciclo_nombre', 'nombre', 'apellido', 'nombre_completo', 'dni', 'telefono', 'email', 'fecha_nacimiento', 'edad', 'activo', 'es_gerente', 'created_at', 'updated_at']

    def get_nombre_completo(self, obj):
        return f"{obj.apellido}, {obj.nombre}"
