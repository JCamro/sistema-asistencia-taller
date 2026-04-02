from rest_framework import serializers
from ..models import Recibo, ReciboMatricula, Matricula
from ..services import ReciboService
from datetime import datetime


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
        nombres = []
        for rm in obj.matriculas.select_related('matricula__alumno'):
            a = rm.matricula.alumno
            nombre = f"{a.nombre} {a.apellido}"
            if nombre not in nombres:
                nombres.append(nombre)
        return nombres

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
        nombres = []
        for rm in obj.matriculas.select_related('matricula__alumno'):
            a = rm.matricula.alumno
            nombre = f"{a.nombre} {a.apellido}"
            if nombre not in nombres:
                nombres.append(nombre)
        return nombres

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
            
            matriculas_data = []
            for mid in matricula_ids:
                matricula = Matricula.objects.select_related('taller', 'alumno').get(id=mid)
                precio = PrecioPaquete.get_precio_individual(
                    matricula.taller.tipo,
                    matricula.sesiones_contratadas
                )
                precio_val = precio['precio_total'] if precio else 0
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
                    'tipo': matricula.taller.tipo,
                    'sesiones': matricula.sesiones_contratadas,
                    'precio': precio_val
                })

            paquete_detectado = self._detectar_paquete(matriculas_data)
            
            precio_sugerido = total
            descuento = 0
            
            if paquete_detectado != 'individual':
                precio_sugerido = self._calcular_precio_paquete(paquete_detectado, matriculas_data)
                descuento = total - precio_sugerido

            return {
                'precio_bruto': total,
                'precio_sugerido': precio_sugerido,
                'descuento': descuento,
                'paquete_detectado': paquete_detectado,
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
    
    def _detectar_paquete(self, matriculas_data):
        if len(matriculas_data) < 2:
            return 'individual'
        
        tipos = [m['tipo'] for m in matriculas_data]
        sesiones = [m['sesiones'] for m in matriculas_data]
        
        tiene_instrumento = 'instrumento' in tipos
        tiene_taller = 'taller' in tipos
        
        sesiones_set = set(sesiones)
        sesiones_sorted = sorted(sesiones_set)
        
        # Caso: solo instrumentos
        if tiene_instrumento and not tiene_taller:
            if sesiones_sorted == [12]:
                return 'combo_musical_12'
            elif sesiones_sorted == [8]:
                return 'combo_musical_8'
            elif sesiones_sorted == [8, 12]:
                return 'combo_musical_12_8'
        
        # Caso: mixto (instrumento + taller)
        if tiene_instrumento and tiene_taller:
            if sesiones_sorted == [12]:
                return 'mixto_12'
            elif sesiones_sorted == [8]:
                return 'mixto_8'
            elif sesiones_sorted == [8, 12]:
                return 'mixto_12_8'
        
        # Caso: solo talleres
        if tiene_taller and not tiene_instrumento:
            if 12 in sesiones_set:
                return 'intensivo_taller'
            elif 8 in sesiones_set:
                return 'intensivo_taller'
        
        return 'individual'
    
    def _calcular_precio_paquete(self, paquete, matriculas_data):
        precios_paquete = {
            'combo_musical_12': 360,
            'combo_musical_8': 220,
            'combo_musical_12_8': 280,
            'mixto_12': 340,
            'mixto_8': 320,
            'mixto_12_8': 380,
            'intensivo_instrumento': 280,
            'intensivo_taller': 160,
        }
        
        if paquete in precios_paquete:
            return precios_paquete[paquete]
        
        return sum(m['precio'] for m in matriculas_data)
