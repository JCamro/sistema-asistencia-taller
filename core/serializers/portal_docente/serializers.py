from rest_framework import serializers

from core.models import Ciclo, Horario, Asistencia, Matricula, Alumno, NotaClase, PagoProfesor
from core.models.hora_trabajada import HoraTrabajada


class ProfesorSerializer(serializers.Serializer):
    """Profesor profile for portal docente responses."""
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    apellido = serializers.CharField()
    dni = serializers.CharField()
    email = serializers.EmailField()
    telefono = serializers.CharField()


class CicloBasicSerializer(serializers.ModelSerializer):
    """Minimal ciclo data for portal docente responses."""

    class Meta:
        model = Ciclo
        fields = ['id', 'nombre', 'tipo', 'fecha_inicio', 'fecha_fin', 'activo']


class HorarioConAlumnosSerializer(serializers.ModelSerializer):
    """Horario detail with enrolled student list."""
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    taller_tipo = serializers.CharField(source='taller.tipo', read_only=True)
    profesor_nombre = serializers.SerializerMethodField()
    alumnos_count = serializers.SerializerMethodField()
    alumnos = serializers.SerializerMethodField()

    class Meta:
        model = Horario
        fields = [
            'id', 'dia_semana', 'hora_inicio', 'hora_fin',
            'taller_nombre', 'taller_tipo', 'profesor_nombre',
            'alumnos_count', 'alumnos',
        ]

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"

    def get_alumnos_count(self, obj):
        return Matricula.objects.filter(
            horarios__horario=obj,
            activo=True,
            concluida=False,
        ).distinct().count()

    def get_alumnos(self, obj):
        alumnos = Alumno.objects.filter(
            matriculas__horarios__horario=obj,
            matriculas__activo=True,
            matriculas__concluida=False,
        ).distinct().values('id', 'nombre', 'apellido', 'dni', 'telefono')
        return list(alumnos)


class AsistenciaPorHorarioSerializer(serializers.Serializer):
    """Attendance record for a single student."""
    alumno_id = serializers.IntegerField(source='matricula.alumno.id')
    alumno_nombre = serializers.SerializerMethodField()
    estado = serializers.CharField()
    fecha = serializers.DateField()
    hora = serializers.TimeField()

    def get_alumno_nombre(self, obj):
        return f"{obj.matricula.alumno.apellido}, {obj.matricula.alumno.nombre}"


class HoraTrabajadaSerializer(serializers.ModelSerializer):
    """HoraTrabajada record for portal docente."""
    taller_nombre = serializers.CharField(source='horario.taller.nombre', read_only=True, allow_null=True)
    dia_semana = serializers.SerializerMethodField()

    class Meta:
        model = HoraTrabajada
        fields = [
            'id', 'fecha', 'tipo', 'horas_trabajadas',
            'num_alumnos', 'monto_profesor', 'ganancia_taller',
            'estado', 'observacion', 'taller_nombre', 'dia_semana',
        ]

    def get_dia_semana(self, obj):
        if obj.horario:
            return obj.horario.dia_semana
        return None


class NotaClaseSerializer(serializers.ModelSerializer):
    """NotaClase serializer for list/create/update."""

    class Meta:
        model = NotaClase
        fields = ['id', 'horario', 'fecha', 'contenido', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_horario(self, value):
        """Validate that the horario exists and belongs to the authenticated profesor's ciclo."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            # Horario belongs to profesor check is done in the view layer
            if not value.activo:
                raise serializers.ValidationError('El horario no está activo.')
        return value


class ProfesorDashboardSerializer(serializers.Serializer):
    """Dashboard KPIs for portal docente."""
    clases_hoy = serializers.IntegerField()
    total_alumnos = serializers.IntegerField()
    horas_mes = serializers.FloatField()
    monto_acumulado = serializers.FloatField()
    tiene_pagos = serializers.BooleanField()


class PagoProfesorDetallePortalSerializer(serializers.Serializer):
    """Per-class payment detail for PagoProfesor in portal docente."""
    id = serializers.IntegerField()
    fecha = serializers.DateField()
    taller_nombre = serializers.CharField(source='horario.taller.nombre', allow_null=True)
    num_alumnos = serializers.IntegerField()
    monto_profesor = serializers.FloatField()
    ganancia_taller = serializers.FloatField()


class PagoProfesorPortalSerializer(serializers.Serializer):
    """Payment summary for PagoProfesor in portal docente, with nested detalles."""
    id = serializers.IntegerField()
    fecha_inicio = serializers.DateField()
    fecha_fin = serializers.DateField()
    horas_calculadas = serializers.IntegerField()
    monto_final = serializers.FloatField()
    estado = serializers.CharField()
    estado_display = serializers.CharField(source='get_estado_display')
    fecha_pago = serializers.DateField(allow_null=True)
    detalles = PagoProfesorDetallePortalSerializer(many=True, read_only=True)
