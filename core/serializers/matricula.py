from rest_framework import serializers
from ..models import Matricula, MatriculaHorario


class MatriculaSerializer(serializers.ModelSerializer):
    precio_por_sesion = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sesiones_consumidas = serializers.IntegerField(read_only=True)
    sesiones_disponibles = serializers.IntegerField(read_only=True)
    precio_sugerido = serializers.SerializerMethodField()

    class Meta:
        model = Matricula
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'precio_por_sesion', 'sesiones_consumidas', 'sesiones_disponibles']

    def get_precio_sugerido(self, obj):
        from django.conf import settings
        return None


class MatriculaListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    precio_por_sesion = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sesiones_consumidas = serializers.IntegerField(read_only=True)
    sesiones_disponibles = serializers.IntegerField(read_only=True)

    class Meta:
        model = Matricula
        fields = [
            'id', 'alumno', 'alumno_nombre', 'ciclo', 'ciclo_nombre',
            'taller', 'taller_nombre', 'sesiones_contratadas', 'precio_total',
            'precio_por_sesion', 'modalidad', 'activo', 'concluida',
            'sesiones_consumidas', 'sesiones_disponibles', 'fecha_matricula'
        ]

    def get_alumno_nombre(self, obj):
        return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
