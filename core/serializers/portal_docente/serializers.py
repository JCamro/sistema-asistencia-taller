from datetime import date

from django.db.models import IntegerField, ExpressionWrapper, Value
from django.db.models.functions import ExtractYear
from rest_framework import serializers

from core.models import Ciclo, Horario, Asistencia, Matricula, Alumno, NotaClase, NotaDia, NotaAlumno, PagoProfesor
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
    taller_id = serializers.IntegerField(source='taller.id', read_only=True)
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    taller_tipo = serializers.CharField(source='taller.tipo', read_only=True)
    profesor_nombre = serializers.SerializerMethodField()
    alumnos_count = serializers.SerializerMethodField()
    alumnos = serializers.SerializerMethodField()

    class Meta:
        model = Horario
        fields = [
            'id', 'dia_semana', 'hora_inicio', 'hora_fin',
            'taller_id', 'taller_nombre', 'taller_tipo',
            'profesor_nombre',
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
        current_year = date.today().year
        alumnos = Alumno.objects.filter(
            matriculas__horarios__horario=obj,
            matriculas__activo=True,
            matriculas__concluida=False,
        ).distinct().annotate(
            edad=ExpressionWrapper(
                Value(current_year) - ExtractYear('fecha_nacimiento'),
                output_field=IntegerField()
            )
        ).values('id', 'nombre', 'apellido', 'dni', 'telefono', 'edad')
        return sorted(list(alumnos), key=lambda a: a['apellido'])


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
    taller_nombre = serializers.CharField(source='horario.taller.nombre', read_only=True)

    class Meta:
        model = NotaClase
        fields = ['id', 'horario', 'fecha', 'contenido', 'created_at', 'updated_at', 'taller_nombre']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_horario(self, value):
        """Validate that the horario exists and belongs to the authenticated profesor's ciclo."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            # Horario belongs to profesor check is done in the view layer
            if not value.activo:
                raise serializers.ValidationError('El horario no está activo.')
        return value


class NotaDiaSerializer(serializers.ModelSerializer):
    """NotaDia serializer for list/create/update."""

    class Meta:
        model = NotaDia
        fields = ['id', 'fecha', 'contenido', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotaAlumnoSerializer(serializers.ModelSerializer):
    """NotaAlumno serializer for list/create/update."""
    alumno_nombre = serializers.SerializerMethodField()

    class Meta:
        model = NotaAlumno
        fields = ['id', 'horario', 'alumno', 'alumno_nombre', 'fecha', 'contenido', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_alumno_nombre(self, obj):
        return f"{obj.alumno.apellido}, {obj.alumno.nombre}"


class ProfesorDashboardSerializer(serializers.Serializer):
    """Dashboard KPIs for portal docente."""
    clases_hoy = serializers.IntegerField()
    total_alumnos = serializers.IntegerField()
    horas_mes = serializers.FloatField()
    monto_acumulado = serializers.FloatField()
    tiene_pagos = serializers.BooleanField()


class HorarioResumenSerializer(serializers.Serializer):
    """Summary of a horario with attendance stats for the por-horario endpoint."""
    horario_id = serializers.IntegerField(source='id')
    taller_nombre = serializers.CharField(source='taller.nombre')
    dia_semana = serializers.IntegerField()
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()
    total_clases = serializers.SerializerMethodField()
    fechas = serializers.SerializerMethodField()

    def get_total_clases(self, obj):
        return obj.total_clases if hasattr(obj, 'total_clases') else 0

    def get_fechas(self, obj):
        return obj.fechas if hasattr(obj, 'fechas') else []


class PagoProfesorDetallePortalSerializer(serializers.Serializer):
    """Per-class payment detail for PagoProfesor in portal docente."""
    id = serializers.IntegerField()
    fecha = serializers.DateField()
    taller_nombre = serializers.CharField(source='horario.taller.nombre', allow_null=True)
    num_alumnos = serializers.IntegerField()
    monto_profesor = serializers.FloatField()
    ganancia_taller = serializers.FloatField()


class HorarioBadgeSerializer(serializers.Serializer):
    """Minimal horario data for nested badges inside AlumnoCartilla."""
    id = serializers.IntegerField()
    taller_id = serializers.IntegerField()
    taller_nombre = serializers.CharField()
    taller_tipo = serializers.CharField()
    dia_semana = serializers.IntegerField()
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()


class AlumnoCartillaSerializer(serializers.Serializer):
    """Professor's roll-book entry with nested horario badges."""
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    apellido = serializers.CharField()
    dni = serializers.CharField()
    telefono = serializers.CharField(allow_blank=True, default='')
    email = serializers.EmailField(allow_blank=True, default='')
    horarios = HorarioBadgeSerializer(many=True, read_only=True)


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
