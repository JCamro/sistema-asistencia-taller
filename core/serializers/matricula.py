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

    def validate(self, data):
        from ..models import Matricula
        alumno = data.get('alumno')
        taller = data.get('taller')
        
        if alumno and taller:
            existentes = Matricula.objects.filter(
                alumno=alumno,
                taller=taller,
                activo=True
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
    precio_por_sesion = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    sesiones_consumidas = serializers.IntegerField(read_only=True)
    sesiones_disponibles = serializers.IntegerField(read_only=True)

    class Meta:
        model = Matricula
        fields = [
            'id', 'alumno', 'alumno_nombre', 'ciclo', 'ciclo_nombre',
            'taller', 'taller_nombre', 'sesiones_contratadas', 'precio_total',
            'precio_por_sesion', 'modalidad', 'activo', 'concluida',
            'sesiones_consumidas', 'sesiones_disponibles', 'fecha_matricula',
            'created_at', 'updated_at'
        ]

    def get_alumno_nombre(self, obj):
        return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
