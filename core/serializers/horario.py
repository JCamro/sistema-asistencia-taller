from rest_framework import serializers
from django.db.models import Prefetch
from ..models import Horario, MatriculaHorario


class HorarioSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    profesor_nombre = serializers.SerializerMethodField()
    dia_nombre = serializers.CharField(source='get_dia_semana_display', read_only=True)
    cupo_disponible = serializers.IntegerField(read_only=True)
    alumnos = serializers.SerializerMethodField()
    tipo_pago = serializers.ChoiceField(choices=Horario.TIPO_PAGO, required=False)
    monto_fijo = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = Horario
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"

    def get_alumnos(self, obj):
        # Use prefetched data if available, otherwise fall back to query
        if hasattr(obj, '_prefetched_objects_cache') and '_matricula_horarios' in obj._prefetched_objects_cache:
            matriculas = obj._prefetched_objects_cache['_matricula_horarios']
        else:
            matriculas = MatriculaHorario.objects.filter(
                horario=obj,
                matricula__activo=True,
                matricula__concluida=False
            ).select_related('matricula__alumno')
        return [
            {
                'id': m.matricula.alumno.id,
                'nombre': m.matricula.alumno.nombre,
                'apellido': m.matricula.alumno.apellido,
                'edad': m.matricula.alumno.edad
            }
            for m in matriculas
        ]


class HorarioListSerializer(serializers.ModelSerializer):
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    profesor_nombre = serializers.SerializerMethodField()
    dia_nombre = serializers.CharField(source='get_dia_semana_display', read_only=True)
    cupo_disponible = serializers.IntegerField(read_only=True)
    alumnos = serializers.SerializerMethodField()
    ocupacion = serializers.IntegerField(read_only=True)

    class Meta:
        model = Horario
        fields = [
            'id', 'ciclo', 'ciclo_nombre', 'taller', 'taller_nombre',
            'profesor', 'profesor_nombre', 'dia_semana', 'dia_nombre',
            'hora_inicio', 'hora_fin', 'cupo_maximo', 'cupo_disponible',
            'ocupacion', 'activo', 'alumnos', 'tipo_pago', 'monto_fijo'
        ]

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"

    def get_alumnos(self, obj):
        # Use prefetched data if available, otherwise fall back to query
        if hasattr(obj, '_prefetched_objects_cache') and '_matricula_horarios' in obj._prefetched_objects_cache:
            matriculas = obj._prefetched_objects_cache['_matricula_horarios']
        else:
            matriculas = MatriculaHorario.objects.filter(
                horario=obj,
                matricula__activo=True,
                matricula__concluida=False
            ).select_related('matricula__alumno')
        return [
            {
                'id': m.matricula.alumno.id,
                'nombre': m.matricula.alumno.nombre,
                'apellido': m.matricula.alumno.apellido,
                'edad': m.matricula.alumno.edad
            }
            for m in matriculas
        ]
