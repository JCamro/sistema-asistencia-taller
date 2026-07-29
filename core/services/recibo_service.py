"""
Servicio para la lógica de negocio de Recibos.

Maneja la creación, actualización y distribución de montos
de recibos entre matrículas.
"""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from django.db import models, transaction

from ..models import Matricula, Recibo, ReciboMatricula

FIVE = Decimal('5')


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
            # Guardar datos de las matrículas actuales ANTES de borrar
            # para evitar perder la referencia en la rama de distribución proporcional.
            # Usamos ReciboMatricula.monto (el distribuido) como referencia, no
            # matricula.precio_total (que es el precio original de matriculación).
            tipos_sesiones = {}
            precios_originales = {}
            for rm in instance.matriculas.select_related('matricula__taller').all():
                key = (rm.matricula.taller.tipo, rm.matricula.sesiones_contratadas)
                if key not in tipos_sesiones:
                    tipos_sesiones[key] = []
                tipos_sesiones[key].append(rm.matricula_id)
                precios_originales[rm.matricula_id] = rm.monto

            # Ahora sí borrar y recrear
            instance.matriculas.all().delete()

            monto_total_dec = instance.monto_total
            num_matriculas = len(matricula_ids)

            if len(tipos_sesiones) == 1:
                # Mismo tipo - distribuir equitativamente
                monto_base = monto_total_dec / num_matriculas
                monto_por_matricula = (monto_base / FIVE).quantize(
                    Decimal('1'), rounding=ROUND_HALF_UP
                ) * FIVE
                diferencia = monto_total_dec - (monto_por_matricula * num_matriculas)

                for i, matricula_id in enumerate(matricula_ids):
                    try:
                        matricula = Matricula.objects.get(id=matricula_id)
                        monto = monto_por_matricula + (diferencia if i == 0 else Decimal('0'))
                        ReciboMatricula.objects.create(
                            recibo=instance,
                            matricula=matricula,
                            monto=monto
                        )
                    except Matricula.DoesNotExist:
                        pass
            else:
                # Diferentes tipos - distribuir proporcionalmente
                total_original = sum(precios_originales.values(), Decimal('0'))
                montos = []

                for matricula_id in matricula_ids:
                    if total_original > 0 and matricula_id in precios_originales:
                        proporcion = precios_originales[matricula_id] / total_original
                        monto = monto_total_dec * proporcion
                    else:
                        monto = monto_total_dec / num_matriculas
                    monto = (monto / FIVE).quantize(
                        Decimal('1'), rounding=ROUND_HALF_UP
                    ) * FIVE
                    montos.append(monto)

                diferencia = monto_total_dec - sum(montos)
                if diferencia != 0 and montos:
                    montos[0] = montos[0] + diferencia

                for i, matricula_id in enumerate(matricula_ids):
                    try:
                        matricula = Matricula.objects.get(id=matricula_id)
                        ReciboMatricula.objects.create(
                            recibo=instance,
                            matricula=matricula,
                            monto=montos[i]
                        )
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
            monto_total: Monto total del recibo (Decimal)
        """
        monto_total = Decimal(monto_total or 0)
        num_matriculas = len(matricula_ids)

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

        if len(tipos_sesiones) == 1:
            # Mismo tipo - distribuir equitativamente
            monto_base = monto_total / num_matriculas
            monto_por_matricula = (monto_base / FIVE).quantize(
                Decimal('1'), rounding=ROUND_HALF_UP
            ) * FIVE
            diferencia = monto_total - (monto_por_matricula * num_matriculas)

            for i, matricula_id in enumerate(matricula_ids):
                try:
                    matricula = Matricula.objects.get(id=matricula_id)
                    monto = monto_por_matricula + (diferencia if i == 0 else Decimal('0'))
                    ReciboMatricula.objects.create(
                        recibo=recibo,
                        matricula=matricula,
                        monto=monto
                    )
                    # Actualizar precio de la matrícula con el monto distribuido
                    matricula.precio_total = monto
                    matricula.precio_por_sesion = (monto / matricula.sesiones_contratadas).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    )
                    matricula.save(update_fields=['precio_total', 'precio_por_sesion'])
                except Matricula.DoesNotExist:
                    pass
        else:
            # Diferentes tipos - distribuir proporcionalmente
            precios_originales = {}
            for matricula_id in matricula_ids:
                try:
                    matricula = Matricula.objects.get(id=matricula_id)
                    precios_originales[matricula_id] = matricula.precio_total
                except Matricula.DoesNotExist:
                    pass

            total_original = sum(precios_originales.values(), Decimal('0'))
            montos = []

            for matricula_id in matricula_ids:
                if total_original > 0 and matricula_id in precios_originales:
                    proporcion = precios_originales[matricula_id] / total_original
                    monto = monto_total * proporcion
                else:
                    monto = monto_total / num_matriculas
                monto = (monto / FIVE).quantize(
                    Decimal('1'), rounding=ROUND_HALF_UP
                ) * FIVE
                montos.append(monto)

            diferencia = monto_total - sum(montos)
            if diferencia != 0 and montos:
                montos[0] = montos[0] + diferencia

            for i, matricula_id in enumerate(matricula_ids):
                try:
                    matricula = Matricula.objects.get(id=matricula_id)
                    monto = montos[i]
                    ReciboMatricula.objects.create(
                        recibo=recibo,
                        matricula=matricula,
                        monto=monto
                    )
                    # Actualizar precio de la matrícula con el monto distribuido
                    matricula.precio_total = monto
                    matricula.precio_por_sesion = (monto / matricula.sesiones_contratadas).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    )
                    matricula.save(update_fields=['precio_total', 'precio_por_sesion'])
                except Matricula.DoesNotExist:
                    pass

    @classmethod
    def _actualizar_precios_matriculas(cls, recibo: Recibo) -> None:
        """
        Actualiza los montos de ReciboMatricula proporcionalmente
        cuando cambia el monto_total del recibo sin cambiar matrículas.

        Ya NO muta matricula.precio_total — solo actualiza ReciboMatricula.monto.

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

        monto_total_dec = recibo.monto_total
        num_matriculas = len(matriculas)

        if len(tipos_sesiones) == 1:
            # Mismo tipo - distribuir equitativamente
            monto_por_matricula = (monto_total_dec / num_matriculas).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            for rm in matriculas:
                rm.monto = monto_por_matricula
                rm.save()
        else:
            # Diferentes tipos - distribuir proporcionalmente
            precios_originales = {rm.matricula_id: rm.monto for rm in matriculas}
            total_original = sum(precios_originales.values(), Decimal('0'))

            if total_original == 0:
                monto_por_matricula = (monto_total_dec / num_matriculas).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                for rm in matriculas:
                    rm.monto = monto_por_matricula
                    rm.save()
            else:
                for rm in matriculas:
                    proporcion = precios_originales[rm.matricula_id] / total_original
                    rm.monto = (monto_total_dec * proporcion).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    )
                    rm.save()

    @staticmethod
    def _generar_numero() -> str:
        """
        Genera el número de recibo secuencial.
        
        Usa SELECT ... FOR UPDATE para prevenir race conditions
        entre requests concurrentes.
        
        Returns:
            str: Número de recibo en formato REC-{AÑO}-{SECUENCIA:04d}
        """
        from django.utils import timezone
        año = timezone.now().year
        prefix = f'REC-{año}-'

        # Lock ALL matching rows for this year to prevent concurrent number generation.
        list(Recibo.objects.select_for_update().filter(numero__startswith=prefix))

        ultimo = Recibo.objects.filter(numero__startswith=prefix).aggregate(
            max_seq=models.Max('numero')
        )
        max_val = ultimo['max_seq']
        seq = int(max_val.split('-')[-1]) + 1 if max_val else 1
        return f"{prefix}{seq:04d}"
