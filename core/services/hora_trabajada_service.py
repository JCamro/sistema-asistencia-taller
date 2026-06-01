"""
Servicio para la lógica de negocio de Horas Trabajadas.

Maneja la generación automática desde asistencias, creación manual,
y la máquina de estados para aprobación/rechazo.
"""
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q

from ..models import HoraTrabajada, Asistencia, Profesor, Configuracion
from ..constants import BASE_PAGO, TOPE_MAXIMO, PORCENTAJE_ADICIONAL


class HoraTrabajadaService:
    """Servicio para manejar la lógica de negocio de Horas Trabajadas."""

    @classmethod
    def _get_config_snapshot(cls) -> dict:
        """
        Captura el snapshot actual de configuración para persistir en el registro.

        Returns:
            dict: Configuración actual de pago o valores por defecto
        """
        try:
            config = Configuracion.get_instance()
            return {
                'base_pago': float(config.pago_dinamico_base or BASE_PAGO),
                'tope_maximo': float(config.pago_dinamico_tope or TOPE_MAXIMO),
                'porcentaje_adicional': float(PORCENTAJE_ADICIONAL),
                'ciclo_activo_id': config.ciclo_activo_id,
            }
        except Exception:
            return {
                'base_pago': float(BASE_PAGO),
                'tope_maximo': float(TOPE_MAXIMO),
                'porcentaje_adicional': float(PORCENTAJE_ADICIONAL),
                'ciclo_activo_id': None,
            }

    @classmethod
    @transaction.atomic
    def generar_horas_trabajadas(cls, ciclo, fecha_inicio: date, fecha_fin: date) -> dict:
        """
        Genera horas trabajadas desde asistencias de forma idempotente.

        Agrupa asistencias con estado 'asistio' por (profesor_id, horario_id, fecha)
        y crea o actualiza registros de HoraTrabajada con tipo='clase_regular',
        estado='aprobada', created_from='asistencia_auto'.

        Args:
            ciclo: Instancia del Ciclo
            fecha_inicio: Fecha de inicio del período
            fecha_fin: Fecha de fin del período

        Returns:
            dict: Resultados con información de las horas generadas
        """
        config_snapshot = cls._get_config_snapshot()
        creados = 0
        actualizados = 0

        # Obtener agrupaciones únicas de (profesor_id, horario_id, fecha)
        asistencias_agrupadas = Asistencia.objects.filter(
            horario__ciclo=ciclo,
            estado='asistio',
            fecha__gte=fecha_inicio,
            fecha__lte=fecha_fin,
            horario__isnull=False,
        ).values('profesor_id', 'horario_id', 'fecha').distinct()

        for grupo in asistencias_agrupadas:
            profesor_id = grupo['profesor_id']
            horario_id = grupo['horario_id']
            fecha = grupo['fecha']

            # Contar alumnos asistentes
            num_alumnos = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id=horario_id,
                fecha=fecha,
                estado='asistio',
            ).count()

            # Calcular valor generado desde las matrículas
            asistentes = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id=horario_id,
                fecha=fecha,
                estado='asistio',
            ).select_related('matricula')

            from ..models import Horario
            try:
                horario = Horario.objects.get(id=horario_id)
            except Horario.DoesNotExist:
                continue

            # Calcular montos
            es_pago_fijo = horario.tipo_pago == 'fijo'

            if num_alumnos == 0:
                monto_profesor = Decimal('0.00')
                monto_base = Decimal('0.00')
                monto_adicional = Decimal('0.00')
                valor_generado = Decimal('0.00')
            elif es_pago_fijo and horario.monto_fijo:
                monto_profesor = Decimal(str(horario.monto_fijo))
                monto_base = Decimal('0.00')
                monto_adicional = Decimal('0.00')
                valor_generado = sum(
                    (a.matricula.precio_por_sesion or Decimal('0.00'))
                    for a in asistentes
                )
            else:
                base_pago = Decimal(str(config_snapshot['base_pago']))
                tope_maximo = Decimal(str(config_snapshot['tope_maximo']))
                porcentaje = Decimal(str(config_snapshot['porcentaje_adicional']))
                monto_base = base_pago if num_alumnos > 0 else Decimal('0.00')
                valor_generado = sum(
                    (a.matricula.precio_por_sesion or Decimal('0.00'))
                    for a in asistentes
                )

                if num_alumnos == 1:
                    monto_profesor = base_pago
                    monto_adicional = Decimal('0.00')
                else:
                    monto_adicional_bruto = Decimal('0.00')
                    for a in asistentes[1:]:
                        valor_sesion = a.matricula.precio_por_sesion
                        if valor_sesion:
                            monto_adicional_bruto += valor_sesion * porcentaje
                    monto_total_sin_tope = base_pago + monto_adicional_bruto
                    monto_profesor = min(monto_total_sin_tope, tope_maximo)
                    monto_adicional = monto_profesor - base_pago

            ganancia_taller = valor_generado - monto_profesor

            # Upsert idempotente
            ht, created = HoraTrabajada.objects.update_or_create(
                profesor_id=profesor_id,
                horario_id=horario_id,
                fecha=fecha,
                tipo='clase_regular',
                defaults={
                    'ciclo': ciclo,
                    'horas_trabajadas': Decimal('1.00'),
                    'estado': 'aprobada',
                    'num_alumnos': num_alumnos,
                    'valor_generado': valor_generado,
                    'monto_base': monto_base,
                    'monto_adicional': monto_adicional,
                    'monto_profesor': monto_profesor,
                    'ganancia_taller': ganancia_taller,
                    'config_snapshot': config_snapshot,
                    'created_from': 'asistencia_auto',
                }
            )

            if created:
                creados += 1
            else:
                actualizados += 1

        return {
            'ciclo': ciclo.nombre,
            'fecha_inicio': fecha_inicio.isoformat(),
            'fecha_fin': fecha_fin.isoformat(),
            'creados': creados,
            'actualizados': actualizados,
        }

    @classmethod
    @transaction.atomic
    def crear_manual(cls, data: dict) -> HoraTrabajada:
        """
        Crea un registro manual de hora trabajada.

        Valida:
        - tipo != 'clase_regular'
        - Profesor activo
        - Fecha no futura
        - horas_trabajadas > 0
        - horario nullable solo para hora_extra

        Args:
            data: Diccionario con los datos del registro

        Returns:
            HoraTrabajada: Instancia creada

        Raises:
            ValueError: Si alguna validación falla
        """
        tipo = data.get('tipo')

        if tipo == 'clase_regular':
            raise ValueError("No se puede crear manualmente una clase regular. Use la generación automática.")

        if tipo != 'hora_extra' and not data.get('horario'):
            raise ValueError("El horario es obligatorio para este tipo de registro.")

        if tipo == 'hora_extra' and data.get('horario'):
            raise ValueError("Hora extra no debe tener horario asociado.")

        profesor_value = data.get('profesor')
        # DRF validated_data pasa la instancia del FK, no el ID
        if isinstance(profesor_value, Profesor):
            profesor = profesor_value
            if not profesor.activo:
                raise ValueError("Profesor no encontrado o inactivo.")
        else:
            try:
                profesor = Profesor.objects.get(id=profesor_value, activo=True)
            except Profesor.DoesNotExist:
                raise ValueError("Profesor no encontrado o inactivo.")

        fecha = data.get('fecha')
        if fecha and fecha > date.today():
            raise ValueError("La fecha no puede ser futura.")

        horas_trabajadas = data.get('horas_trabajadas', 0)
        if horas_trabajadas <= 0:
            raise ValueError("Las horas trabajadas deben ser mayores a 0.")

        config_snapshot = cls._get_config_snapshot()

        ht = HoraTrabajada.objects.create(
            profesor=profesor,
            ciclo=data.get('ciclo'),
            horario=data.get('horario', None),
            fecha=fecha,
            tipo=tipo,
            horas_trabajadas=horas_trabajadas,
            estado='pendiente',
            num_alumnos=data.get('num_alumnos', 0),
            valor_generado=data.get('valor_generado', Decimal('0.00')),
            monto_base=data.get('monto_base', Decimal('0.00')),
            monto_adicional=data.get('monto_adicional', Decimal('0.00')),
            monto_profesor=data.get('monto_profesor', Decimal('0.00')),
            ganancia_taller=data.get('ganancia_taller', Decimal('0.00')),
            config_snapshot=config_snapshot,
            observacion=data.get('observacion', ''),
            created_from='admin_manual',
        )

        return ht

    @classmethod
    @transaction.atomic
    def aprobar(cls, instance: HoraTrabajada) -> HoraTrabajada:
        """
        Aprueba un registro pendiente.

        State machine: pendiente → aprobada
        No permite transiciones inversas.
        Marca el registro como inmutable después de la transición.

        Args:
            instance: Instancia de HoraTrabajada

        Returns:
            HoraTrabajada: Instancia actualizada

        Raises:
            ValueError: Si el estado no es 'pendiente'
        """
        if instance.estado != 'pendiente':
            raise ValueError(
                f"Solo se pueden aprobar registros pendientes. "
                f"Estado actual: {instance.get_estado_display()}"
            )

        instance.estado = 'aprobada'
        instance.save()
        return instance

    @classmethod
    @transaction.atomic
    def rechazar(cls, instance: HoraTrabajada) -> HoraTrabajada:
        """
        Rechaza un registro pendiente.

        State machine: pendiente → rechazada
        No permite transiciones inversas.
        Marca el registro como inmutable después de la transición.

        Args:
            instance: Instancia de HoraTrabajada

        Returns:
            HoraTrabajada: Instancia actualizada

        Raises:
            ValueError: Si el estado no es 'pendiente'
        """
        if instance.estado != 'pendiente':
            raise ValueError(
                f"Solo se pueden rechazar registros pendientes. "
                f"Estado actual: {instance.get_estado_display()}"
            )

        instance.estado = 'rechazada'
        instance.save()
        return instance
