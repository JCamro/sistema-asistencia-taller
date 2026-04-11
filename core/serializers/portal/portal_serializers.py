from rest_framework import serializers

from core.models import Alumno, Ciclo, Taller, Matricula, Asistencia, Horario, Recibo


class TallerBasicSerializer(serializers.ModelSerializer):
    """Minimal taller data for portal responses."""
    
    class Meta:
        model = Taller
        fields = ['id', 'nombre', 'tipo']


class PortalAlumnoSerializer(serializers.ModelSerializer):
    """
    Public profile serializer for portal students.
    Excludes sensitive fields: dni, email, telefono, fecha_nacimiento.
    """
    
    class Meta:
        model = Alumno
        fields = ['id', 'nombre', 'apellido']


class PortalCicloSerializer(serializers.ModelSerializer):
    """Ciclo data for portal responses."""
    has_matricula_activa = serializers.SerializerMethodField()
    
    class Meta:
        model = Ciclo
        fields = ['id', 'nombre', 'tipo', 'fecha_inicio', 'fecha_fin', 'activo', 'has_matricula_activa']
    
    def get_has_matricula_activa(self, obj):
        from core.models import Matricula
        alumno = self.context.get('alumno')
        if not alumno:
            return False
        return Matricula.objects.filter(
            alumno=alumno, ciclo=obj, activo=True, concluida=False
        ).exists()


class PortalMatriculaSerializer(serializers.ModelSerializer):
    """Matricula data for portal responses."""
    taller = TallerBasicSerializer(read_only=True)
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    sesiones_disponibles = serializers.IntegerField(read_only=True)
    sesiones_consumidas = serializers.IntegerField(read_only=True)

    class Meta:
        model = Matricula
        fields = [
            'id', 'taller', 'ciclo_nombre', 'sesiones_contratadas', 'sesiones_disponibles',
            'sesiones_consumidas', 'concluida', 'precio_total', 'fecha_matricula'
        ]


class PortalMatriculaHistorialSerializer(PortalMatriculaSerializer):
    """Matricula data for portal responses with attendance percentage."""
    porcentaje_asistencia = serializers.SerializerMethodField()

    class Meta(PortalMatriculaSerializer.Meta):
        fields = PortalMatriculaSerializer.Meta.fields + ['porcentaje_asistencia']

    def get_porcentaje_asistencia(self, obj):
        """Calcula el porcentaje de asistencia: asistidas/total * 100."""
        total = obj.asistencias.count()
        if total == 0:
            return 0
        asistidas = obj.asistencias.filter(estado='asistio').count()
        return round((asistidas / total) * 100, 1)


class PortalAsistenciaSerializer(serializers.ModelSerializer):
    """Asistencia data for portal responses."""
    taller_nombre = serializers.CharField(source='horario.taller.nombre', read_only=True)
    horario_dia = serializers.CharField(source='horario.get_dia_semana_display', read_only=True)
    horario_hora = serializers.SerializerMethodField()
    profesor_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = Asistencia
        fields = ['id', 'fecha', 'hora', 'estado', 'taller_nombre', 'horario_dia', 'horario_hora', 'profesor_nombre']
    
    def get_horario_hora(self, obj):
        return f"{obj.horario.hora_inicio.strftime('%H:%M')}-{obj.horario.hora_fin.strftime('%H:%M')}"
    
    def get_profesor_nombre(self, obj):
        return f"{obj.horario.profesor.apellido}, {obj.horario.profesor.nombre}"


class PortalHorarioSerializer(serializers.ModelSerializer):
    """Horario data for portal responses."""
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    profesor_nombre = serializers.SerializerMethodField()
    salon = serializers.CharField(source='taller.ciclo.nombre', read_only=True, default='')
    
    class Meta:
        model = Horario
        fields = ['id', 'dia_semana', 'hora_inicio', 'hora_fin', 'taller_nombre', 'profesor_nombre', 'salon']
    
    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"


class PortalReciboSerializer(serializers.ModelSerializer):
    """Recibo data for portal responses (enriched with discount and packages)."""
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    porcentaje_descuento = serializers.SerializerMethodField()
    paquetes = serializers.SerializerMethodField()
    
    class Meta:
        model = Recibo
        fields = [
            'id', 'numero', 'monto_total', 'monto_pagado', 'saldo_pendiente',
            'estado', 'fecha_emision', 'porcentaje_descuento', 'paquetes'
        ]
    
    def get_porcentaje_descuento(self, obj):
        """Calcula el porcentaje de descuento aplicado."""
        return obj.porcentaje_descuento
    
    def get_paquetes(self, obj):
        """Obtiene lista de nombres de talleres desde ReciboMatricula -> Matricula -> Taller."""
        # Lazy import para evitar circular imports
        from core.models import ReciboMatricula
        recibo_matricula_ids = ReciboMatricula.objects.filter(recibo=obj).values_list('matricula__taller__nombre', flat=True)
        return list(recibo_matricula_ids)


class PortalDashboardSerializer(serializers.Serializer):
    """Dashboard aggregated data for portal responses."""
    total_matriculas = serializers.IntegerField()
    sesiones_disponibles_total = serializers.IntegerField()
    proxima_clase = PortalHorarioSerializer(allow_null=True)
    ultimas_asistencias = PortalAsistenciaSerializer(many=True)
    pagos_pendientes_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    pagos_pendientes_cantidad = serializers.IntegerField()
