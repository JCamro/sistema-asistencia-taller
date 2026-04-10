from rest_framework import serializers
from django.db.models import Case, When, Value, CharField
from ..models import Matricula, MatriculaHorario
from ..services import MatriculaService


class MatriculaSerializer(serializers.ModelSerializer):
    precio_por_sesion = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sesiones_consumidas = serializers.IntegerField(read_only=True)
    sesiones_disponibles = serializers.IntegerField(read_only=True)
    precio_sugerido = serializers.SerializerMethodField()
    estado_calculado = serializers.SerializerMethodField()
    horarios = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    fecha_matricula = serializers.DateTimeField(required=False, allow_null=True)

    class Meta:
        model = Matricula
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'precio_por_sesion', 'sesiones_consumidas', 'sesiones_disponibles', 'estado_calculado']

    def get_precio_sugerido(self, obj):
        from django.conf import settings
        return None

    def create(self, validated_data):
        horarios_ids = validated_data.pop('horarios', [])
        return MatriculaService.create(validated_data, horarios_ids)

    def update(self, instance, validated_data):
        from decimal import Decimal

        horarios_ids = validated_data.pop('horarios', None)

        sesiones_nuevo = validated_data.get('sesiones_contratadas')
        precio_total_nuevo = validated_data.get('precio_total')

        # Lógica de recálculo para mantener consistencia
        if sesiones_nuevo is not None and precio_total_nuevo is not None:
            # Ambos cambiaron → precio_total manda, recalcular precio_por_sesion
            if sesiones_nuevo > 0:
                validated_data['precio_por_sesion'] = Decimal(str(precio_total_nuevo)) / sesiones_nuevo
        elif sesiones_nuevo is not None and precio_total_nuevo is None:
            # Solo cambiaron sesiones → recalcular precio_total desde precio_por_sesion
            validated_data['precio_total'] = instance.precio_por_sesion * sesiones_nuevo
        elif precio_total_nuevo is not None and sesiones_nuevo is None:
            # Solo cambió precio_total → recalcular precio_por_sesion
            sesiones = instance.sesiones_contratadas
            if sesiones > 0:
                validated_data['precio_por_sesion'] = Decimal(str(precio_total_nuevo)) / sesiones

        return MatriculaService.update(instance, validated_data, horarios_ids)

    def get_estado_calculado(self, obj):
        # Use annotated field if available (for list views), otherwise compute inline
        if hasattr(obj, 'estado_calculado') and obj.estado_calculado is not None:
            return obj.estado_calculado
        if not obj.activo:
            return 'inactiva'
        if obj.concluida:
            return 'concluida'
        from ..models import ReciboMatricula
        tiene_recibo = ReciboMatricula.objects.filter(
            matricula=obj,
            recibo__estado__in=['pagado', 'pendiente']
        ).exists()
        return 'activa' if tiene_recibo else 'no_procesado'

    def validate(self, data):
        from ..models import Matricula
        alumno = data.get('alumno')
        taller = data.get('taller')
        
        if alumno and taller:
            existentes = Matricula.objects.filter(
                alumno=alumno,
                taller=taller,
                activo=True,
                concluida=False
            )
            if self.instance:
                existentes = existentes.exclude(id=self.instance.id)
            
            if existentes.exists():
                raise serializers.ValidationError(
                    "El alumno ya tiene una matrícula activa en este taller. "
                    "Debe concluir o inactivarse la matrícula actual."
                )
        
        if 'horarios' in data and data['horarios']:
            from ..models import MatriculaHorario, Horario
            horarios_ids = data['horarios']
            
            nuevos_horarios = Horario.objects.filter(id__in=horarios_ids)
            for nuevo in nuevos_horarios:
                nuevo_inicio = nuevo.hora_inicio
                nuevo_fin = nuevo.hora_fin
                
                coincidencias = MatriculaHorario.objects.filter(
                    horario__dia_semana=nuevo.dia_semana,
                    horario__hora_inicio__lt=nuevo_fin,
                    horario__hora_fin__gt=nuevo_inicio,
                    matricula__alumno=alumno,
                    matricula__activo=True,
                    matricula__concluida=False
                )
                
                if self.instance:
                    coincidencias = coincidencias.exclude(matricula=self.instance)
                
                if coincidencias.exists():
                    conflicto = coincidencias.first()
                    raise serializers.ValidationError(
                        f"El horario del {conflicto.horario.get_dia_semana_display()} "
                        f"de {conflicto.horario.hora_inicio} a {conflicto.horario.hora_fin} "
                        f"se interpone con otra matrícula existente ({conflicto.horario.taller.nombre}). "
                        f"Elija un horario diferente."
                    )
        
        return data


class MatriculaListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    taller_nombre = serializers.CharField(source='taller.nombre', read_only=True)
    taller_tipo = serializers.CharField(source='taller.tipo', read_only=True)
    precio_por_sesion = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sesiones_consumidas = serializers.IntegerField(read_only=True)
    sesiones_disponibles = serializers.IntegerField(read_only=True)
    estado_calculado = serializers.CharField(read_only=True)

    class Meta:
        model = Matricula
        fields = [
            'id', 'alumno', 'alumno_nombre', 'ciclo', 'ciclo_nombre',
            'taller', 'taller_nombre', 'taller_tipo', 'sesiones_contratadas', 'precio_total',
            'precio_por_sesion', 'metodo_pago', 'activo', 'concluida', 'estado_calculado',
            'sesiones_consumidas', 'sesiones_disponibles', 'fecha_matricula',
            'created_at', 'updated_at'
        ]

    def get_alumno_nombre(self, obj):
        return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
