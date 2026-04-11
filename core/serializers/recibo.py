from rest_framework import serializers
from ..models import Recibo, ReciboMatricula, Matricula
from ..services import ReciboService
from ..serializer_helpers import get_alumnos_nombres


class ReciboMatriculaSerializer(serializers.ModelSerializer):
    taller_nombre = serializers.SerializerMethodField()
    taller_tipo = serializers.SerializerMethodField()
    alumno_nombre = serializers.SerializerMethodField()
    sesiones_contratadas = serializers.SerializerMethodField()

    class Meta:
        model = ReciboMatricula
        fields = ['id', 'matricula', 'taller_nombre', 'taller_tipo', 'alumno_nombre', 'sesiones_contratadas', 'monto']

    def get_taller_nombre(self, obj):
        return obj.matricula.taller.nombre

    def get_taller_tipo(self, obj):
        return obj.matricula.taller.tipo

    def get_alumno_nombre(self, obj):
        a = obj.matricula.alumno
        return f"{a.nombre} {a.apellido}"

    def get_sesiones_contratadas(self, obj):
        return obj.matricula.sesiones_contratadas


class ReciboSerializer(serializers.ModelSerializer):
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    porcentaje_descuento = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)
    matriculas_detalle = ReciboMatriculaSerializer(source='matriculas', many=True, read_only=True)
    matricula_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    alumno_nombre = serializers.SerializerMethodField()
    alumnos_nombres = serializers.SerializerMethodField()

    class Meta:
        model = Recibo
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'saldo_pendiente', 'porcentaje_descuento', 'numero']

    def get_alumno_nombre(self, obj):
        if obj.alumno:
            return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
        primera = obj.matriculas.select_related('matricula__alumno').first()
        if primera:
            a = primera.matricula.alumno
            return f"{a.apellido}, {a.nombre}"
        return "Sin alumno"

    def get_alumnos_nombres(self, obj):
        return get_alumnos_nombres(obj)

    def create(self, validated_data):
        matricula_ids = validated_data.pop('matricula_ids', [])
        return ReciboService.create_recibo(validated_data, matricula_ids)

    def update(self, instance, validated_data):
        matricula_ids = validated_data.pop('matricula_ids', None)
        return ReciboService.update_recibo(instance, validated_data, matricula_ids)


class ReciboListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    alumnos_nombres = serializers.SerializerMethodField()
    matricula_ids = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    paquete_display = serializers.CharField(source='get_paquete_aplicado_display', read_only=True)

    class Meta:
        model = Recibo
        fields = [
            'id', 'numero', 'alumno', 'alumno_nombre', 'alumnos_nombres',
            'matricula_ids', 'ciclo', 'ciclo_nombre', 'fecha_emision', 'monto_bruto', 'monto_total',
            'monto_pagado', 'descuento', 'paquete_aplicado', 'paquete_display',
            'precio_editado', 'saldo_pendiente', 'estado'
        ]

    def get_alumno_nombre(self, obj):
        if obj.alumno:
            return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
        primera = obj.matriculas.select_related('matricula__alumno').first()
        if primera:
            a = primera.matricula.alumno
            return f"{a.apellido}, {a.nombre}"
        return "Sin alumno"

    def get_alumnos_nombres(self, obj):
        return get_alumnos_nombres(obj)

    def get_matricula_ids(self, obj):
        return list(obj.matriculas.values_list('matricula_id', flat=True))


class CalcularPrecioSerializer(serializers.Serializer):
    matricula_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )

    def validate_matricula_ids(self, value):
        for mid in value:
            if not Matricula.objects.filter(id=mid).exists():
                raise serializers.ValidationError(f"Matrícula {mid} no existe")
        return value

    def calcular(self):
        from ..models import PrecioPaquete
        
        try:
            matricula_ids = self.validated_data['matricula_ids']
            total = 0
            detalles = []
            
            # Obtener el ciclo de la primera matrícula para buscar precios específicos
            ciclo_id = None
            matriculas_data = []
            for mid in matricula_ids:
                matricula = Matricula.objects.select_related('taller', 'alumno', 'ciclo').get(id=mid)
                
                # Usar el ciclo de la matrícula para precios específicos
                if ciclo_id is None and matricula.ciclo_id:
                    ciclo_id = matricula.ciclo_id
                
                precio = PrecioPaquete.get_precio_individual(
                    matricula.taller.tipo,
                    matricula.sesiones_contratadas,
                    ciclo_id
                )
                # Si no hay precio configurado, usar precio_por_sesion de la matrícula
                if precio:
                    precio_val = precio['precio_total']
                else:
                    # Fallback: calcular desde precio_por_sesion de la matrícula
                    precio_por_sesion = float(matricula.precio_por_sesion or 0)
                    precio_val = precio_por_sesion * matricula.sesiones_contratadas
                total += precio_val
                detalles.append({
                    'matricula_id': mid,
                    'alumno': f"{matricula.alumno.nombre} {matricula.alumno.apellido}",
                    'taller': matricula.taller.nombre,
                    'taller_tipo': matricula.taller.tipo,
                    'cantidad_clases': matricula.sesiones_contratadas,
                    'precio_individual': precio_val
                })
                matriculas_data.append({
                    'tipo_taller': matricula.taller.tipo,
                    'cantidad_clases': matricula.sesiones_contratadas
                })

            # Usar PrecioPaquete.calcular_precio_recomendado que lee de la BD
            resultado_precio = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id)
            
            if resultado_precio:
                return {
                    'precio_bruto': resultado_precio['precio_bruto'],
                    'precio_sugerido': resultado_precio['precio_sugerido'],
                    'descuento': resultado_precio['descuento'],
                    'paquete_detectado': resultado_precio['paquete_detectado'],
                    'desglose': resultado_precio.get('desglose', []),
                    'detalles': detalles
                }
            
            # Fallback si no se pudo calcular
            return {
                'precio_bruto': total,
                'precio_sugerido': total,
                'descuento': 0,
                'paquete_detectado': 'individual',
                'desglose': [],
                'detalles': detalles
            }
        except Exception as e:
            import logging
            logging.error(f"Error calculating price: {e}")
            import traceback
            logging.error(traceback.format_exc())
            return {
                'precio_bruto': 0,
                'precio_sugerido': 0,
                'descuento': 0,
                'paquete_detectado': 'individual',
                'desglose': [],
                'detalles': []
            }
