from rest_framework import serializers
from ..models import MatriculaHorario, Matricula, Horario
from datetime import time


class MatriculaHorarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatriculaHorario
        fields = '__all__'
        read_only_fields = ['created_at']

    def validate(self, data):
        matricula = data['matricula']
        horario = data['horario']

        if MatriculaHorario.objects.filter(matricula=matricula, horario=horario).exists():
            raise serializers.ValidationError("El estudiante ya está matriculado en este horario")

        if not matricula.activo:
            raise serializers.ValidationError("La matrícula no está activa")

        if matricula.concluida:
            raise serializers.ValidationError("La matrícula ya está concluida")

        if matricula.sesiones_consumidas >= matricula.sesiones_contratadas:
            raise serializers.ValidationError("La matrícula no tiene sesiones disponibles")

        ocupacion = horario.matricula_horarios.filter(
            matricula__activo=True,
            matricula__concluida=False
        ).count()

        if ocupacion >= horario.cupo_maximo:
            raise serializers.ValidationError(f"El horario no tiene cupos disponibles. Cupo máximo: {horario.cupo_maximo}")

        matriculas_mismo_ciclo = Matricula.objects.filter(
            alumno=matricula.alumno,
            ciclo=horario.ciclo,
            activo=True
        ).prefetch_related('horarios__horario')

        nuevo_inicio = horario.hora_inicio
        nuevo_fin = horario.hora_fin

        for m in matriculas_mismo_ciclo:
            for mh in m.horarios.all():
                h = mh.horario
                if h.dia_semana == horario.dia_semana and h.id != horario.id:
                    if (nuevo_inicio < h.hora_fin and nuevo_fin > h.hora_inicio):
                        raise serializers.ValidationError(
                            f"Conflicto de horario con {h.taller.nombre} ({h.get_dia_semana_display()} {h.hora_inicio}-{h.hora_fin})"
                        )

        return data

    def validate_horario(self, value):
        if not value.activo:
            raise serializers.ValidationError("El horario no está activo")
        return value


class MatriculaHorarioListSerializer(serializers.ModelSerializer):
    horario_detalle = serializers.SerializerMethodField()
    matricula_detalle = serializers.SerializerMethodField()

    class Meta:
        model = MatriculaHorario
        fields = ['id', 'matricula', 'matricula_detalle', 'horario', 'horario_detalle', 'created_at']

    def get_horario_detalle(self, obj):
        return {
            'taller': obj.horario.taller.nombre,
            'profesor': f"{obj.horario.profesor.apellido}, {obj.horario.profesor.nombre}",
            'dia': obj.horario.get_dia_semana_display(),
            'hora_inicio': obj.horario.hora_inicio.strftime('%H:%M'),
            'hora_fin': obj.horario.hora_fin.strftime('%H:%M'),
        }

    def get_matricula_detalle(self, obj):
        return {
            'alumno': f"{obj.matricula.alumno.apellido}, {obj.matricula.alumno.nombre}",
            'sesiones_disponibles': obj.matricula.sesiones_disponibles,
        }
