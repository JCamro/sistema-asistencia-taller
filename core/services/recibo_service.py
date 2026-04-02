"""
Servicio para la lógica de negocio de Recibos.

Maneja la creación, actualización y distribución de montos
de recibos entre matrículas.
"""
from datetime import datetime
from decimal import Decimal

from django.db import transaction

from ..models import Matricula, Recibo, ReciboMatricula


class ReciboService:
    """Servicio para manejar la lógica de negocio de Recibos."""

    @classmethod
    @transaction.atomic
    def create_recibo(cls, validated_data: dict, matricula_ids: list) -> Recibo:
        """
        Crea un recibo y distribuye el monto entre las matrículas.
        
        Args:
            validated_data: Datos validados del serializer (sin matricula_ids)
            matricula_ids: Lista de IDs de matrículas a asociar
            
        Returns:
            Recibo: El recibo creado
        """
        matricula_ids = matricula_ids or []
        validated_data['numero'] = cls._generar_numero()

        monto_total = validated_data.get('monto_total', 0)
        monto_bruto = validated_data.get('monto_bruto', monto_total)

        if monto_total and monto_total > 0:
            validated_data['monto_bruto'] = monto_bruto
            if monto_bruto != monto_total:
                validated_data['precio_editado'] = True
                validated_data['descuento'] = monto_bruto - monto_total

        recibo = Recibo.objects.create(**validated_data)

        cls._distribute_amounts(recibo, matricula_ids, monto_total)

        return recibo

    @classmethod
    @transaction.atomic
    def update_recibo(cls, instance: Recibo, validated_data: dict, matricula_ids: list = None) -> Recibo:
        """
        Actualiza un recibo existente.
        
        Args:
            instance: Instancia del recibo a actualizar
            validated_data: Datos validados del serializer
            matricula_ids: Lista de IDs de matrículas (None para no cambiar)
            
        Returns:
            Recibo: El recibo actualizado
        """
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
            cls._actualizar_precios_matriculas(instance)

        return instance

    @classmethod
    def _distribute_amounts(cls, recibo: Recibo, matricula_ids: list, monto_total) -> None:
        """
        Distribuye el monto total entre las matrículas.
        
        Si todas las matrículas son del mismo tipo y sesiones, distribuye equitativamente.
        Si son de diferentes tipos, distribuye proporcionalmente.
        
        Args:
            recibo: Instancia del recibo
            matricula_ids: Lista de IDs de matrículas
            monto_total: Monto total del recibo
        """
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

    @classmethod
    def _actualizar_precios_matriculas(cls, recibo: Recibo) -> None:
        """
        Actualiza los precios de las matrículas proporcionalmente según el monto_total del recibo.
        
        Args:
            recibo: Instancia del recibo
        """
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

    @staticmethod
    def _generar_numero() -> str:
        """
        Genera el número de recibo secuencial.
        
        Returns:
            str: Número de recibo en formato REC-{AÑO}-{SECUENCIA:04d}
        """
        año = datetime.now().year
        count = Recibo.objects.filter(numero__startswith=f'REC-{año}').count()
        return f"REC-{año}-{count + 1:04d}"
