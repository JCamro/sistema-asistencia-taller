from rest_framework import serializers
from ..models import Recibo, ReciboMatricula, Matricula
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
        validated_data['numero'] = self._generar_numero()

        monto_total = validated_data.get('monto_total', 0)
        monto_bruto = validated_data.get('monto_bruto', monto_total)

        if monto_total and monto_total > 0:
            validated_data['monto_bruto'] = monto_bruto
            if monto_bruto != monto_total:
                validated_data['precio_editado'] = True
                validated_data['descuento'] = monto_bruto - monto_total

        recibo = Recibo.objects.create(**validated_data)

        # Determinar si todas las matrículas son del mismo tipo y sesiones
        tipos_sesiones = {}
        for matricula_id in matricula_ids:
            try:
                matricula = Matricula.objects.select_related('taller').get(id=matricula_id)
                key = (matricula.taller.tipo, matricula.sesiones_contratadas)
                if key not in tipos_sesiones:
                    tipos_sesiones[key] = []
                tipos_sesiones[key].append(matricula_id)
            except Matricula.DoesNotExist:
                pass
        
        monto_total_float = float(monto_total)
        num_matriculas = len(matricula_ids)
        
        if len(tipos_sesiones) == 1:
            # Mismo tipo - distribuir equitativamente con mejor redondeo
            monto_base = monto_total_float / num_matriculas
            monto_por_matricula = round(monto_base / 5) * 5
            diferencia = monto_total_float - (monto_por_matricula * num_matriculas)
            ajuste = round(diferencia, 2)
            
            for i, matricula_id in enumerate(matricula_ids):
                try:
                    matricula = Matricula.objects.get(id=matricula_id)
                    monto = monto_por_matricula + (ajuste if i == 0 else 0)
                    ReciboMatricula.objects.create(
                        recibo=recibo,
                        matricula=matricula,
                        monto=monto
                    )
                    matricula.precio_total = monto
                    matricula.save()
                except Matricula.DoesNotExist:
                    pass
        else:
            # Diferentes tipos - distribuir proporcionalmente con mejor redondeo
            precios_originales = {}
            for matricula_id in matricula_ids:
                try:
                    matricula = Matricula.objects.get(id=matricula_id)
                    precios_originales[matricula_id] = float(matricula.precio_total)
                except Matricula.DoesNotExist:
                    pass
            
            total_original = sum(precios_originales.values())
            montos = []
            
            for matricula_id in matricula_ids:
                if total_original > 0 and matricula_id in precios_originales:
                    proporcion = precios_originales[matricula_id] / total_original
                    monto = monto_total_float * proporcion
                else:
                    monto = monto_total_float / num_matriculas
                monto = round(monto / 5) * 5
                montos.append(monto)
            
            diferencia = monto_total_float - sum(montos)
            if diferencia != 0 and montos:
                montos[0] = round(montos[0] + diferencia, 2)
            
            for i, matricula_id in enumerate(matricula_ids):
                try:
                    matricula = Matricula.objects.get(id=matricula_id)
                    ReciboMatricula.objects.create(
                        recibo=recibo,
                        matricula=matricula,
                        monto=montos[i]
                    )
                    matricula.precio_total = montos[i]
                    matricula.save()
                except Matricula.DoesNotExist:
                    pass

        return recibo

    def update(self, instance, validated_data):
        matricula_ids = validated_data.pop('matricula_ids', None)
        
        monto_total_cambió = 'monto_total' in validated_data

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if 'monto_total' in validated_data:
            if instance.monto_bruto and instance.monto_total != instance.monto_bruto:
                instance.precio_editado = True
                instance.descuento = instance.monto_bruto - instance.monto_total

        instance.save()

        if matricula_ids is not None and len(matricula_ids) > 0:
            # Determinar si todas las matrículas son del mismo tipo
            tipos_sesiones = {}
            for rm in instance.matriculas.all():
                key = (rm.matricula.taller.tipo, rm.matricula.sesiones_contratadas)
                if key not in tipos_sesiones:
                    tipos_sesiones[key] = []
                tipos_sesiones[key].append(rm.matricula_id)
            
            instance.matriculas.all().delete()
            
            monto_total_float = float(instance.monto_total)
            num_matriculas = len(matricula_ids)
            
            if len(tipos_sesiones) == 1:
                # Mismo tipo - distribuir equitativamente con mejor redondeo
                monto_base = monto_total_float / num_matriculas
                monto_por_matricula = round(monto_base / 5) * 5
                diferencia = monto_total_float - (monto_por_matricula * num_matriculas)
                ajuste = round(diferencia, 2)
                
                for i, matricula_id in enumerate(matricula_ids):
                    try:
                        matricula = Matricula.objects.get(id=matricula_id)
                        monto = monto_por_matricula + (ajuste if i == 0 else 0)
                        ReciboMatricula.objects.create(
                            recibo=instance,
                            matricula=matricula,
                            monto=monto
                        )
                        matricula.precio_total = monto
                        matricula.save()
                    except Matricula.DoesNotExist:
                        pass
            else:
                # Diferentes tipos - distribuir proporcionalmente con mejor redondeo
                precios_originales = {}
                for rm in instance.matriculas.all():
                    precios_originales[rm.matricula_id] = float(rm.matricula.precio_total)
                
                total_original = sum(precios_originales.values())
                montos = []
                
                for matricula_id in matricula_ids:
                    if total_original > 0 and matricula_id in precios_originales:
                        proporcion = precios_originales[matricula_id] / total_original
                        monto = monto_total_float * proporcion
                    else:
                        monto = monto_total_float / num_matriculas
                    monto = round(monto / 5) * 5
                    montos.append(monto)
                
                diferencia = monto_total_float - sum(montos)
                if diferencia != 0 and montos:
                    montos[0] = round(montos[0] + diferencia, 2)
                
                for i, matricula_id in enumerate(matricula_ids):
                    try:
                        matricula = Matricula.objects.get(id=matricula_id)
                        ReciboMatricula.objects.create(
                            recibo=instance,
                            matricula=matricula,
                            monto=montos[i]
                        )
                        matricula.precio_total = montos[i]
                        matricula.save()
                    except Matricula.DoesNotExist:
                        pass
        elif monto_total_cambió and instance.matriculas.exists():
            self._actualizar_precios_matriculas(instance)

        return instance
    
    def _actualizar_precios_matriculas(self, recibo):
        """Actualiza los precios de las matrículas proporcionalmente según el monto_total del recibo"""
        matriculas = list(ReciboMatricula.objects.filter(recibo=recibo).select_related('matricula__taller'))
        
        if not matriculas:
            return
        
        # Verificar si todas son del mismo tipo
        tipos_sesiones = set()
        for rm in matriculas:
            tipos_sesiones.add((rm.matricula.taller.tipo, rm.matricula.sesiones_contratadas))
        
        monto_total_float = float(recibo.monto_total)
        
        if len(tipos_sesiones) == 1:
            # Mismo tipo - distribuir equitativamente
            monto_por_matricula = round(monto_total_float / len(matriculas), 2)
            for rm in matriculas:
                rm.monto = monto_por_matricula
                rm.save()
                rm.matricula.precio_total = monto_por_matricula
                rm.matricula.save()
        else:
            # Diferentes tipos - distribuir proporcionalmente por monto original
            precios_originales = {}
            for rm in matriculas:
                precios_originales[rm.matricula_id] = float(rm.monto)
            
            total_original = sum(precios_originales.values())
            
            if total_original == 0:
                monto_por_matricula = monto_total_float / len(matriculas)
                for rm in matriculas:
                    rm.monto = monto_por_matricula
                    rm.save()
                    rm.matricula.precio_total = monto_por_matricula
                    rm.matricula.save()
            else:
                for rm in matriculas:
                    proporcion = precios_originales[rm.matricula_id] / total_original
                    nuevo_monto = round(monto_total_float * proporcion, 2)
                    rm.monto = nuevo_monto
                    rm.save()
                    rm.matricula.precio_total = nuevo_monto
                    rm.matricula.save()

    def _generar_numero(self):
        año = datetime.now().year
        count = Recibo.objects.filter(numero__startswith=f'REC-{año}').count()
        return f"REC-{año}-{count + 1:04d}"


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
