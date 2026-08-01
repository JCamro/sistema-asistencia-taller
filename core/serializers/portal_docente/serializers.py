from datetime import date

from django.db.models import IntegerField, ExpressionWrapper, Value
from django.db.models.functions import ExtractYear
from rest_framework import serializers

from core.models import Ciclo, Egreso, Horario, Asistencia, Matricula, Alumno, NotaClase, NotaDia, NotaAlumno, PagoProfesor
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


# Deterministic color palette derived from taller.id
COLORES_TALLER = [
    '#e94560', '#0f3460', '#16a34a', '#d97706', '#7c3aed',
    '#0891b2', '#be185d', '#65a30d', '#c026d3', '#ea580c',
    '#0284c7', '#84cc16', '#db2777', '#14b8a6', '#f97316',
]


def _get_taller_color(taller_id):
    """Derive a deterministic color from taller.id."""
    return COLORES_TALLER[taller_id % len(COLORES_TALLER)]


class HorarioConAlumnosSerializer(serializers.ModelSerializer):
    """Horario detail with enrolled student list."""
    taller_id = serializers.IntegerField(source='taller.id', read_only=True)
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    taller_tipo = serializers.CharField(source='taller.tipo', read_only=True)
    taller_color = serializers.SerializerMethodField()
    profesor_nombre = serializers.SerializerMethodField()
    alumnos_count = serializers.SerializerMethodField()
    cupo_maximo = serializers.IntegerField(read_only=True)
    cupo_disponible = serializers.SerializerMethodField()
    alumnos = serializers.SerializerMethodField()

    class Meta:
        model = Horario
        fields = [
            'id', 'dia_semana', 'hora_inicio', 'hora_fin',
            'taller_id', 'taller_nombre', 'taller_tipo', 'taller_color',
            'profesor_nombre',
            'alumnos_count', 'cupo_maximo', 'cupo_disponible', 'alumnos',
        ]

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"

    def get_taller_color(self, obj):
        return _get_taller_color(obj.taller_id)

    def get_cupo_disponible(self, obj):
        return max(0, obj.cupo_maximo - self.get_alumnos_count(obj))

    def get_alumnos_count(self, obj):
        # Use view annotation when available (avoids N+1 query)
        if hasattr(obj, '_alumnos_count'):
            return obj._alumnos_count
        return Matricula.objects.filter(
            horarios__horario=obj,
            activo=True,
            concluida=False,
        ).distinct().count()

    def get_alumnos(self, obj):
        current_year = date.today().year
        # Use prefetched matricula_horarios when available (avoids N+1)
        if hasattr(obj, 'matricula_horarios') and hasattr(obj.matricula_horarios, 'all'):
            seen = set()
            result = []
            for mh in obj.matricula_horarios.all():
                a = mh.matricula.alumno
                if a.id not in seen:
                    seen.add(a.id)
                    edad = current_year - a.fecha_nacimiento.year if a.fecha_nacimiento else None
                    result.append({
                        'id': a.id,
                        'nombre': a.nombre,
                        'apellido': a.apellido,
                        'dni': a.dni,
                        'telefono': a.telefono or '',
                        'edad': edad,
                    })
            return sorted(result, key=lambda x: x['apellido'])

        # Fallback: direct query (used when prefetch not available)
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


class AsistenciaRegistroSerializer(serializers.Serializer):
    """Single attendance record for a student."""
    alumno = serializers.SerializerMethodField()
    estado = serializers.CharField()
    es_recuperacion = serializers.BooleanField()

    def get_alumno(self, obj):
        a = obj.matricula.alumno
        return {
            'id': a.id,
            'nombre': a.nombre,
            'apellido': a.apellido,
            'dni': a.dni,
            'telefono': a.telefono or '',
        }


class AlumnoResumenEntrySerializer(serializers.Serializer):
    """Unified student row for a horario/date combination."""
    alumno_id = serializers.IntegerField()
    nombre = serializers.CharField()
    apellido = serializers.CharField()
    dni = serializers.CharField()
    estado_asistencia = serializers.CharField(allow_null=True)
    es_recuperacion = serializers.BooleanField()
    hora_asistencia = serializers.TimeField(allow_null=True, format='%H:%M')
    inscripcion_activa = serializers.BooleanField()


class HorarioResumenFechaSerializer(serializers.Serializer):
    """Date-aware unified response for a horario."""
    modo = serializers.CharField()
    fecha = serializers.DateField()
    aviso = serializers.CharField(allow_null=True)
    horario_id = serializers.IntegerField()
    taller_nombre = serializers.CharField()
    hora_inicio = serializers.TimeField(format='%H:%M')
    hora_fin = serializers.TimeField(format='%H:%M')
    registros = AlumnoResumenEntrySerializer(many=True)


class AsistenciaPorHorarioSerializer(serializers.Serializer):
    """Grouped attendance response: horario info + student records."""
    horario = serializers.SerializerMethodField()
    registros = serializers.SerializerMethodField()

    def get_horario(self, obj):
        h = obj['horario']
        return {
            'id': h.id,
            'dia_semana': h.dia_semana,
            'hora_inicio': str(h.hora_inicio),
            'hora_fin': str(h.hora_fin),
            'taller_id': h.taller_id,
            'taller_nombre': h.taller.nombre,
            'taller_tipo': h.taller.tipo,
        }

    def get_registros(self, obj):
        return AsistenciaRegistroSerializer(obj['asistencias'], many=True).data


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


class HoraTrabajadaDetalleSerializer(serializers.Serializer):
    """Detailed worked-hour row with attendance and class notes."""
    fecha = serializers.DateField(format='%Y-%m-%d')
    hora_inicio = serializers.TimeField(source='horario.hora_inicio', format='%H:%M', allow_null=True)
    hora_fin = serializers.TimeField(source='horario.hora_fin', format='%H:%M', allow_null=True)
    taller_nombre = serializers.CharField(source='horario.taller.nombre', allow_null=True)
    num_alumnos = serializers.IntegerField()
    monto_profesor = serializers.DecimalField(max_digits=10, decimal_places=2)
    observacion = serializers.CharField(allow_blank=True)
    alumnos = serializers.SerializerMethodField()
    nota_clase = serializers.SerializerMethodField(allow_null=True)

    def get_alumnos(self, obj):
        alumnos_map = self.context.get('alumnos_map', {})
        return alumnos_map.get((obj.horario_id, obj.fecha), [])

    def get_nota_clase(self, obj):
        notas_map = self.context.get('notas_map', {})
        return notas_map.get((obj.horario_id, obj.fecha))


class NotaClaseSerializer(serializers.ModelSerializer):
    """NotaClase serializer for list/create/update."""
    taller_nombre = serializers.CharField(source='horario.taller.nombre', read_only=True)
    dia_semana = serializers.IntegerField(source='horario.dia_semana', read_only=True)
    hora_inicio = serializers.CharField(source='horario.hora_inicio', read_only=True)
    hora_fin = serializers.CharField(source='horario.hora_fin', read_only=True)

    class Meta:
        model = NotaClase
        fields = ['id', 'horario', 'dia_semana', 'hora_inicio', 'hora_fin', 'fecha', 'contenido', 'created_at', 'updated_at', 'taller_nombre']
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
    """NotaDia serializer for list/create/update. fecha is server-managed (always today)."""

    class Meta:
        model = NotaDia
        fields = ['id', 'titulo', 'fecha', 'contenido', 'created_at', 'updated_at']
        read_only_fields = ['id', 'fecha', 'created_at', 'updated_at']


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
    estado = serializers.CharField()
    fecha_ultima_asistencia = serializers.DateField(allow_null=True)
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


class EgresoPortalSerializer(serializers.ModelSerializer):
    """Egreso serializer for portal docente — read-only payment view."""
    class Meta:
        model = Egreso
        fields = ['id', 'monto', 'descripcion', 'fecha', 'metodo_pago',
                  'estado', 'beneficiario', 'created_at']
        read_only_fields = fields


# ─── Alumno-specific asistencias (SidePanel) ─────────────────────────────

class MatriculaMiniSerializer(serializers.Serializer):
    """Minimal matrícula info for grouping asistencias."""
    id = serializers.IntegerField()
    taller_nombre = serializers.CharField()
    taller_id = serializers.IntegerField()
    activa = serializers.BooleanField()       # activo=True, concluida=False
    concluida = serializers.BooleanField()
    sesiones_contratadas = serializers.IntegerField()


class AsistenciaAlumnoSerializer(serializers.Serializer):
    """Individual asistencia record for a specific alumno."""
    id = serializers.IntegerField()
    fecha = serializers.DateField()
    hora = serializers.TimeField()
    estado = serializers.CharField()
    horario_id = serializers.IntegerField()


class AlumnoAsistenciaGrupoSerializer(serializers.Serializer):
    """Group of asistencias under one matrícula."""
    matricula = MatriculaMiniSerializer()
    asistencias = AsistenciaAlumnoSerializer(many=True)


# ─── Alumno Detalle Consolidado (SidePanel) ────────────────────────────

class AsistenciaAlumnoDetalleSerializer(serializers.Serializer):
    """Single attendance record in alumno detalle."""
    fecha = serializers.DateField()
    estado = serializers.CharField()
    hora = serializers.TimeField()


class MatriculaActivaSerializer(serializers.Serializer):
    """Active enrollment with schedule, progress, and attendance list."""
    id = serializers.IntegerField()
    taller_id = serializers.IntegerField()
    taller_nombre = serializers.CharField()
    dia_semana = serializers.IntegerField(allow_null=True)
    hora_inicio = serializers.TimeField(allow_null=True)
    hora_fin = serializers.TimeField(allow_null=True)
    sesiones_contratadas = serializers.IntegerField()
    sesiones_consumidas = serializers.IntegerField()
    sesiones_disponibles = serializers.IntegerField()
    precio_por_sesion = serializers.CharField()
    asistencias = AsistenciaAlumnoDetalleSerializer(many=True)


class TallerActivoSerializer(serializers.Serializer):
    """Summary of an active enrollment (for multi-active dropdown)."""
    matricula_id = serializers.IntegerField()
    taller_id = serializers.IntegerField()
    taller_nombre = serializers.CharField()


class MatriculaHistoricaSerializer(serializers.Serializer):
    """Past concluded/inactive enrollment summary."""
    id = serializers.IntegerField()
    taller_nombre = serializers.CharField()
    sesiones_contratadas = serializers.IntegerField()
    sesiones_consumidas = serializers.IntegerField()
    concluida = serializers.BooleanField()


class EstadisticasAlumnoSerializer(serializers.Serializer):
    """Global attendance statistics across all matriculas."""
    tasa_asistencia = serializers.FloatField()
    total_asistencias = serializers.IntegerField()
    total_faltas = serializers.IntegerField()


class AlumnoDetalleSerializer(serializers.Serializer):
    """Consolidated alumno detail response."""
    alumno = AlumnoCartillaSerializer()
    talleres_activos = TallerActivoSerializer(many=True, allow_null=True)
    matricula_activa = MatriculaActivaSerializer(allow_null=True)
    matriculas_historicas = MatriculaHistoricaSerializer(many=True)
    estadisticas = EstadisticasAlumnoSerializer()
