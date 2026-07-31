from rest_framework import serializers
from datetime import date

from ..models import HoraTrabajada, Profesor
from ..shared.serializer_helpers import get_profesor_nombre


class HoraTrabajadaListSerializer(serializers.ModelSerializer):
    profesor_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    created_from_display = serializers.CharField(source='get_created_from_display', read_only=True)
    horario_info = serializers.SerializerMethodField()
    horario_profesor_id = serializers.SerializerMethodField()
    horario_profesor_nombre = serializers.SerializerMethodField()
    es_sustituto = serializers.SerializerMethodField()

    class Meta:
        model = HoraTrabajada
        fields = [
            'id', 'profesor', 'profesor_nombre', 'ciclo', 'ciclo_nombre',
            'horario', 'fecha', 'tipo', 'tipo_display', 'horas_trabajadas',
            'created_from', 'created_from_display',
            'num_alumnos', 'valor_generado', 'monto_profesor', 'horario_info',
            'horario_profesor_id', 'horario_profesor_nombre', 'es_sustituto',
        ]

    def get_profesor_nombre(self, obj):
        return get_profesor_nombre(obj)

    def get_horario_info(self, obj):
        if not obj.horario:
            return None
        inicio = obj.horario.hora_inicio
        fin = obj.horario.hora_fin
        if hasattr(inicio, 'strftime'):
            inicio_str = inicio.strftime('%H:%M')
            fin_str = fin.strftime('%H:%M')
        else:
            inicio_str = str(inicio)[:5]
            fin_str = str(fin)[:5]
        return (
            f"{obj.horario.taller.nombre} - "
            f"{obj.horario.get_dia_semana_display()} "
            f"{inicio_str}-{fin_str}"
        )

    def get_horario_profesor_id(self, obj):
        return obj.horario.profesor_id if obj.horario else None

    def get_horario_profesor_nombre(self, obj):
        return get_profesor_nombre(obj.horario, attr='profesor') if obj.horario else None

    def get_es_sustituto(self, obj):
        return bool(obj.horario and obj.profesor_id != obj.horario.profesor_id)


class HoraTrabajadaDetailSerializer(serializers.ModelSerializer):
    profesor_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    created_from_display = serializers.CharField(source='get_created_from_display', read_only=True)
    horario_info = serializers.SerializerMethodField()
    horario_profesor_id = serializers.SerializerMethodField()
    horario_profesor_nombre = serializers.SerializerMethodField()
    es_sustituto = serializers.SerializerMethodField()

    class Meta:
        model = HoraTrabajada
        fields = '__all__'
        read_only_fields = ['config_snapshot', 'created_at', 'updated_at']

    def get_profesor_nombre(self, obj):
        return get_profesor_nombre(obj)

    def get_horario_info(self, obj):
        if not obj.horario:
            return None
        inicio = obj.horario.hora_inicio
        fin = obj.horario.hora_fin
        if hasattr(inicio, 'strftime'):
            inicio_str = inicio.strftime('%H:%M')
            fin_str = fin.strftime('%H:%M')
        else:
            inicio_str = str(inicio)[:5]
            fin_str = str(fin)[:5]
        return (
            f"{obj.horario.taller.nombre} - "
            f"{obj.horario.get_dia_semana_display()} "
            f"{inicio_str}-{fin_str}"
        )

    def get_horario_profesor_id(self, obj):
        return obj.horario.profesor_id if obj.horario else None

    def get_horario_profesor_nombre(self, obj):
        return get_profesor_nombre(obj.horario, attr='profesor') if obj.horario else None

    def get_es_sustituto(self, obj):
        return bool(obj.horario and obj.profesor_id != obj.horario.profesor_id)


class HoraTrabajadaCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HoraTrabajada
        fields = [
            'profesor', 'ciclo', 'horario', 'fecha',
            'horas_trabajadas', 'monto_profesor', 'observacion',
        ]
        extra_kwargs = {
            'monto_profesor': {'required': True},
        }

    def validate(self, data):
        # Validar horario: obligatorio
        if not data.get('horario'):
            raise serializers.ValidationError(
                {"horario": "El horario es obligatorio."}
            )

        # Validar fecha no futura
        fecha = data.get('fecha')
        if fecha and fecha > date.today():
            raise serializers.ValidationError(
                {"fecha": "La fecha no puede ser futura."}
            )

        # Validar horas_trabajadas > 0
        horas = data.get('horas_trabajadas', 0)
        if horas is not None and horas <= 0:
            raise serializers.ValidationError(
                {"horas_trabajadas": "Las horas trabajadas deben ser mayores a 0."}
            )

        # Validar monto_profesor > 0
        monto = data.get('monto_profesor')
        if monto is not None and monto <= 0:
            raise serializers.ValidationError(
                {"monto_profesor": "El monto debe ser mayor a 0."}
            )

        # Validar profesor activo (pertenencia al horario se permite diferir para sustitutos)
        profesor = data.get('profesor')
        if profesor:
            try:
                Profesor.objects.get(id=profesor.id, activo=True)
            except Profesor.DoesNotExist:
                raise serializers.ValidationError(
                    {"profesor": "Profesor no encontrado o inactivo."}
                )

        return data
