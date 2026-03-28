from rest_framework import serializers
from ..models import Asistencia


class AsistenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asistencia
        fields = [
            'id', 'matricula', 'horario', 'profesor', 
            'fecha', 'hora', 'estado', 'observacion', 
            'es_recuperacion', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        asistencia = super().create(validated_data)
        
        # Actualizar el campo concluida de la matrícula
        if asistencia.matricula_id:
            from ..models import Matricula
            try:
                matricula = Matricula.objects.get(id=asistencia.matricula_id)
                if matricula.sesiones_disponibles <= 0:
                    matricula.concluida = True
                    matricula.save()
            except Matricula.DoesNotExist:
                pass
        
        return asistencia

    def update(self, instance, validated_data):
        old_estado = instance.estado
        old_matricula_id = instance.matricula_id
        new_estado = validated_data.get('estado', instance.estado)
        
        instance = super().update(instance, validated_data)
        
        # Actualizar el campo concluida de la matrícula
        if old_matricula_id:
            from ..models import Matricula
            try:
                matricula = Matricula.objects.get(id=old_matricula_id)
                if matricula.sesiones_disponibles <= 0:
                    matricula.concluida = True
                    matricula.save()
                elif matricula.concluida and matricula.sesiones_disponibles > 0:
                    matricula.concluida = False
                    matricula.save()
            except Matricula.DoesNotExist:
                pass
        
        return instance


class AsistenciaListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    taller_nombre = serializers.SerializerMethodField()
    profesor_nombre = serializers.SerializerMethodField()
    alumno_id = serializers.SerializerMethodField()
    horario_dia = serializers.SerializerMethodField()
    horario_hora_inicio = serializers.SerializerMethodField()
    horario_hora_fin = serializers.SerializerMethodField()

    class Meta:
        model = Asistencia
        fields = [
            'id', 'matricula', 'alumno_id', 'alumno_nombre', 'horario', 'taller_nombre',
            'profesor', 'profesor_nombre', 'fecha', 'hora', 'estado', 'observacion',
            'es_recuperacion', 'horario_dia', 'horario_hora_inicio', 'horario_hora_fin'
        ]

    def get_alumno_nombre(self, obj):
        if obj.matricula:
            return f"{obj.matricula.alumno.apellido}, {obj.matricula.alumno.nombre}"
        return "Sin matrícula"

    def get_alumno_id(self, obj):
        if obj.matricula:
            return obj.matricula.alumno.id
        return None

    def get_taller_nombre(self, obj):
        return obj.horario.taller.nombre

    def get_profesor_nombre(self, obj):
        return f"{obj.profesor.apellido}, {obj.profesor.nombre}"

    def get_horario_dia(self, obj):
        return obj.horario.get_dia_semana_display()

    def get_horario_hora_inicio(self, obj):
        return obj.horario.hora_inicio.strftime('%H:%M')

    def get_horario_hora_fin(self, obj):
        return obj.horario.hora_fin.strftime('%H:%M')
