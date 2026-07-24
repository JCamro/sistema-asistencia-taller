"""
Servicio para la lógica de negocio de Horas Trabajadas.

Maneja la generación automática desde asistencias (vía señal) y creación manual.
"""
from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Q

from ..models import HoraTrabajada, Asistencia, Horario, Profesor, Configuracion, Ciclo
from ..shared.constants import BASE_PAGO, TOPE_MAXIMO, PORCENTAJE_ADICIONAL


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
    def _detect_overlap_groups(cls, grupo_dicts, horario_map):
        """
        Detecta grupos de horarios solapados para la misma fecha y profesor.

        Un solapamiento se define como múltiples horarios que comparten el mismo
        (profesor_id, dia_semana, hora_inicio, hora_fin) para una misma fecha.
        Solo se considera solapamiento cuando hay coincidencia EXACTA de horario
        (misma hora de inicio y misma hora de fin).

        Args:
            grupo_dicts: Lista de dicts con 'profesor_id', 'horario_id', 'fecha'
                         (proveniente de values().distinct() de Asistencia)
            horario_map: Dict {horario_id: {dia_semana, hora_inicio, hora_fin,
                                            taller_nombre, tipo_pago, monto_fijo}}

        Returns:
            tuple: (overlaps, singles)
                overlaps: Lista de dicts con solapamientos detectados.
                    Cada dict tiene: profesor_id, fecha, horario_ids (ordenados),
                    representative_id (el de menor ID), taller_nombres (ordenados
                    alfabéticamente), has_mixto (bool si hay distintos tipo_pago).
                singles: Lista de dicts sin solapamiento.
                    Cada dict tiene: profesor_id, horario_id, fecha.
        """
        from collections import defaultdict

        groups = defaultdict(list)
        for grupo in grupo_dicts:
            pid = grupo['profesor_id']
            hid = grupo['horario_id']
            fecha = grupo['fecha']

            meta = horario_map.get(hid)
            if not meta:
                continue

            key = (pid, fecha, meta['dia_semana'],
                   meta['hora_inicio'], meta['hora_fin'])
            groups[key].append(hid)

        overlaps = []
        singles = []

        for key, horario_ids in groups.items():
            pid, fecha, dia_semana, hora_inicio, hora_fin = key
            sorted_ids = sorted(horario_ids)

            if len(sorted_ids) > 1:
                representative_id = sorted_ids[0]
                taller_nombres = sorted([
                    horario_map[hid]['taller_nombre']
                    for hid in sorted_ids if hid in horario_map
                ])

                rep_tipo_pago = horario_map.get(representative_id, {}).get('tipo_pago')
                has_mixto = any(
                    horario_map.get(hid, {}).get('tipo_pago') != rep_tipo_pago
                    for hid in sorted_ids if hid in horario_map
                )

                overlaps.append({
                    'profesor_id': pid,
                    'fecha': fecha,
                    'horario_ids': sorted_ids,
                    'representative_id': representative_id,
                    'taller_nombres': taller_nombres,
                    'has_mixto': has_mixto,
                })
            else:
                singles.append({
                    'profesor_id': pid,
                    'horario_id': sorted_ids[0],
                    'fecha': fecha,
                })

        return overlaps, singles

    @classmethod
    def _calcular_montos_para_clase(
        cls, num_alumnos, asistentes, horario_meta, config_snapshot
    ):
        """
        Calcula los montos de pago para una clase usando la fórmula estándar.

        Fórmula dinámica (configurable via Configuracion):
        - 0 alumnos → S/. 0.00
        - 1 alumno  → S/. [base] fijo
        - 2+ alumnos → S/. [base] + 50% del valor de sesión de cada alumno adicional
        - Tope      → Máx [tope] por clase

        Fórmula fija:
        - 0 alumnos → S/. 0.00
        - 1+ alumnos → monto_fijo del horario (monto_base=0, monto_adicional=0)

        Args:
            num_alumnos: Número de alumnos asistentes
            asistentes: QuerySet de Asistencia con select_related('matricula')
            horario_meta: Dict con metadatos del horario (tipo_pago, monto_fijo)
            config_snapshot: Dict con configuración actual de pago

        Returns:
            dict: {valor_generado, monto_base, monto_adicional, monto_profesor}
        """
        es_pago_fijo = horario_meta.get('tipo_pago') == 'fijo'

        if num_alumnos == 0:
            if es_pago_fijo:
                return {
                    'valor_generado': Decimal('0.00'),
                    'monto_base': Decimal('0.00'),
                    'monto_adicional': Decimal('0.00'),
                    'monto_profesor': Decimal('0.00'),
                }
            base_pago = Decimal(str(config_snapshot['base_pago']))
            return {
                'valor_generado': Decimal('0.00'),
                'monto_base': base_pago,
                'monto_adicional': Decimal('0.00'),
                'monto_profesor': base_pago,
            }

        if es_pago_fijo:
            monto_fijo = horario_meta.get('monto_fijo')
            monto_profesor = Decimal(str(monto_fijo)) if monto_fijo is not None else Decimal('0.00')
            valor_generado = sum(
                (a.matricula.precio_por_sesion or Decimal('0.00'))
                for a in asistentes
            )
            return {
                'valor_generado': valor_generado,
                'monto_base': Decimal('0.00'),
                'monto_adicional': Decimal('0.00'),
                'monto_profesor': monto_profesor,
            }

        # Pago dinámico
        base_pago = Decimal(str(config_snapshot['base_pago']))
        tope_maximo = Decimal(str(config_snapshot['tope_maximo']))
        porcentaje = Decimal(str(config_snapshot['porcentaje_adicional']))

        valor_generado = sum(
            (a.matricula.precio_por_sesion or Decimal('0.00'))
            for a in asistentes
        )
        monto_base = base_pago

        if num_alumnos == 1:
            return {
                'valor_generado': valor_generado,
                'monto_base': monto_base,
                'monto_adicional': Decimal('0.00'),
                'monto_profesor': base_pago,
            }

        monto_adicional_bruto = Decimal('0.00')
        for a in asistentes[1:]:
            valor_sesion = a.matricula.precio_por_sesion
            if valor_sesion:
                monto_adicional_bruto += valor_sesion * porcentaje

        monto_total_sin_tope = base_pago + monto_adicional_bruto
        monto_profesor = min(monto_total_sin_tope, tope_maximo)
        monto_adicional = monto_profesor - base_pago

        return {
            'valor_generado': valor_generado,
            'monto_base': monto_base,
            'monto_adicional': monto_adicional,
            'monto_profesor': monto_profesor,
        }

    @classmethod
    @transaction.atomic
    def generar_horas_trabajadas(cls, ciclo, fecha_inicio: date, fecha_fin: date) -> dict:
        """
        Genera horas trabajadas desde asistencias de forma idempotente.

        Agrupa asistencias con estado 'asistio' por (profesor_id, horario_id, fecha)
        y crea o actualiza registros de HoraTrabajada con tipo='clase_regular',
        estado='aprobada', created_from='asistencia_auto'.

        Cuando múltiples horarios del mismo profesor comparten el mismo horario
        (dia_semana, hora_inicio, hora_fin) en la misma fecha, se consolidan
        en un único registro de HoraTrabajada con la suma de alumnos asistentes
        y el valor generado combinado.

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
        consolidados = 0

        # Obtener agrupaciones únicas de (profesor_id, horario_id, fecha)
        asistencias_agrupadas = Asistencia.objects.filter(
            horario__ciclo=ciclo,
            estado='asistio',
            fecha__gte=fecha_inicio,
            fecha__lte=fecha_fin,
            horario__isnull=False,
        ).values('profesor_id', 'horario_id', 'fecha').distinct()

        # Construir mapa de metadatos de horarios (una sola query)
        from ..models import Horario
        grupo_list = list(asistencias_agrupadas)
        horario_ids = set(g['horario_id'] for g in grupo_list)

        # Filtrar registros que ya fueron creados manualmente como clase_regular
        manual_combos = set(
            HoraTrabajada.objects.filter(
                ciclo=ciclo, created_from='admin_manual', tipo='clase_regular',
                fecha__gte=fecha_inicio, fecha__lte=fecha_fin,
            ).values_list('profesor_id', 'horario_id', 'fecha')
        )
        if manual_combos:
            grupo_list = [
                g for g in grupo_list
                if (g['profesor_id'], g['horario_id'], g['fecha']) not in manual_combos
            ]

        horarios_qs = Horario.objects.filter(id__in=horario_ids).select_related('taller')
        horario_map = {}
        for h in horarios_qs:
            horario_map[h.id] = {
                'dia_semana': h.dia_semana,
                'hora_inicio': h.hora_inicio,
                'hora_fin': h.hora_fin,
                'taller_nombre': h.taller.nombre,
                'tipo_pago': h.tipo_pago,
                'monto_fijo': h.monto_fijo,
            }

        # Detectar grupos solapados vs individuales
        overlaps, singles = cls._detect_overlap_groups(grupo_list, horario_map)

        # ===== Procesar grupos solapados (consolidación) =====
        for overlap in overlaps:
            profesor_id = overlap['profesor_id']
            fecha = overlap['fecha']
            horario_ids_overlap = overlap['horario_ids']
            rep_id = overlap['representative_id']
            taller_nombres = overlap['taller_nombres']
            has_mixto = overlap['has_mixto']
            non_rep_ids = [hid for hid in horario_ids_overlap if hid != rep_id]

            # 1. Eliminar registros HoraTrabajada obsoletos de horarios no representativos
            HoraTrabajada.objects.filter(
                profesor_id=profesor_id,
                horario_id__in=non_rep_ids,
                fecha=fecha,
                tipo='clase_regular',
            ).delete()

            # 2. Contar asistencias (incluye recuperaciones) de TODOS los horarios
            num_alumnos = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id__in=horario_ids_overlap,
                fecha=fecha,
                estado='asistio',
            ).count()

            # 3. Obtener asistentes (incluye recuperaciones) para cálculo de valor generado
            asistentes = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id__in=horario_ids_overlap,
                fecha=fecha,
                estado='asistio',
            ).select_related('matricula')

            # 4. Calcular montos usando metadatos del representativo
            rep_meta = horario_map.get(rep_id, {})
            montos = cls._calcular_montos_para_clase(
                num_alumnos, asistentes, rep_meta, config_snapshot
            )

            ganancia_taller = montos['valor_generado'] - montos['monto_profesor']

            # 5. Construir observación
            observacion = 'Consolidado: ' + ' + '.join(taller_nombres)
            if has_mixto:
                observacion += ' (mixto)'

            # 6. Upsert del registro consolidado
            try:
                ht, created = HoraTrabajada.objects.update_or_create(
                    profesor_id=profesor_id,
                    horario_id=rep_id,
                    fecha=fecha,
                    tipo='clase_regular',
                    defaults={
                        'ciclo': ciclo,
                        'horas_trabajadas': Decimal('1.00'),
                        'estado': 'aprobada',
                        'num_alumnos': num_alumnos,
                        'valor_generado': montos['valor_generado'],
                        'monto_base': montos['monto_base'],
                        'monto_adicional': montos['monto_adicional'],
                        'monto_profesor': montos['monto_profesor'],
                        'ganancia_taller': ganancia_taller,
                        'config_snapshot': config_snapshot,
                        'created_from': 'asistencia_auto',
                        'observacion': observacion,
                    }
                )
            except IntegrityError:
                ht, created = HoraTrabajada.objects.update_or_create(
                    profesor_id=profesor_id,
                    horario_id=rep_id,
                    fecha=fecha,
                    tipo='clase_regular',
                    defaults={
                        'ciclo': ciclo,
                        'horas_trabajadas': Decimal('1.00'),
                        'estado': 'aprobada',
                        'num_alumnos': num_alumnos,
                        'valor_generado': montos['valor_generado'],
                        'monto_base': montos['monto_base'],
                        'monto_adicional': montos['monto_adicional'],
                        'monto_profesor': montos['monto_profesor'],
                        'ganancia_taller': ganancia_taller,
                        'config_snapshot': config_snapshot,
                        'created_from': 'asistencia_auto',
                        'observacion': observacion,
                    }
                )

            if created:
                creados += 1
            else:
                actualizados += 1

            consolidados += 1

            # 7. Procesar asistencias de recuperación para horarios no representativos
            #    (las recuperaciones del representativo se incluyen en el consolidado)
            rec_creados, rec_actualizados = cls._procesar_recuperaciones(
                profesor_id, fecha, non_rep_ids, ciclo, config_snapshot, horario_map
            )
            creados += rec_creados
            actualizados += rec_actualizados

        # ===== Procesar horarios individuales (sin solapamiento, comportamiento original) =====
        for grupo in singles:
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

            # Obtener asistentes para cálculo
            asistentes = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id=horario_id,
                fecha=fecha,
                estado='asistio',
            ).select_related('matricula')

            # Obtener metadatos del horario
            horario_meta = horario_map.get(horario_id)
            if not horario_meta:
                continue

            # Calcular montos
            montos = cls._calcular_montos_para_clase(
                num_alumnos, asistentes, horario_meta, config_snapshot
            )

            ganancia_taller = montos['valor_generado'] - montos['monto_profesor']

            # Upsert idempotente
            try:
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
                        'valor_generado': montos['valor_generado'],
                        'monto_base': montos['monto_base'],
                        'monto_adicional': montos['monto_adicional'],
                        'monto_profesor': montos['monto_profesor'],
                        'ganancia_taller': ganancia_taller,
                        'config_snapshot': config_snapshot,
                        'created_from': 'asistencia_auto',
                    }
                )
            except IntegrityError:
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
                        'valor_generado': montos['valor_generado'],
                        'monto_base': montos['monto_base'],
                        'monto_adicional': montos['monto_adicional'],
                        'monto_profesor': montos['monto_profesor'],
                        'ganancia_taller': ganancia_taller,
                        'config_snapshot': config_snapshot,
                        'created_from': 'asistencia_auto',
                    }
                )

            if created:
                creados += 1
            else:
                actualizados += 1

        # ===== Contabilizar consolidaciones en el recuento =====
        # Nota: 'consolidados' se actualizó dentro del bucle de solapamientos

        return {
            'ciclo': ciclo.nombre,
            'fecha_inicio': fecha_inicio.isoformat(),
            'fecha_fin': fecha_fin.isoformat(),
            'creados': creados,
            'actualizados': actualizados,
            'consolidados': consolidados,
        }

    @classmethod
    def _procesar_recuperaciones(
        cls, profesor_id, fecha, horario_ids, ciclo, config_snapshot, horario_map
    ):
        """
        Procesa asistencias de recuperación para horarios en un grupo solapado.

        Las asistencias con es_recuperacion=True generan registros independientes
        de HoraTrabajada para cada horario, SIN ser consolidadas.
        Esto solo aplica para horarios NO representativos — las recuperaciones
        del horario representativo se incluyen en el registro consolidado.

        Args:
            profesor_id: ID del profesor
            fecha: Fecha de la clase
            horario_ids: Lista de IDs de horarios a procesar (no representativos)
            ciclo: Instancia del Ciclo
            config_snapshot: Snapshot de configuración
            horario_map: Mapa de metadatos de horarios

        Returns:
            tuple: (creados, actualizados) contadores de registros de recuperación
        """
        creados = 0
        actualizados = 0

        for hid in horario_ids:
            recovery_count = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id=hid,
                fecha=fecha,
                estado='asistio',
                es_recuperacion=True,
            ).count()

            if recovery_count == 0:
                continue

            recovery_asistentes = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id=hid,
                fecha=fecha,
                estado='asistio',
                es_recuperacion=True,
            ).select_related('matricula')

            recovery_meta = horario_map.get(hid, {})
            montos = cls._calcular_montos_para_clase(
                recovery_count, recovery_asistentes, recovery_meta, config_snapshot
            )

            recovery_ganancia = montos['valor_generado'] - montos['monto_profesor']

            ht, created = HoraTrabajada.objects.update_or_create(
                profesor_id=profesor_id,
                horario_id=hid,
                fecha=fecha,
                tipo='clase_regular',
                defaults={
                    'ciclo': ciclo,
                    'horas_trabajadas': Decimal('1.00'),
                    'estado': 'aprobada',
                    'num_alumnos': recovery_count,
                    'valor_generado': montos['valor_generado'],
                    'monto_base': montos['monto_base'],
                    'monto_adicional': montos['monto_adicional'],
                    'monto_profesor': montos['monto_profesor'],
                    'ganancia_taller': recovery_ganancia,
                    'config_snapshot': config_snapshot,
                    'created_from': 'asistencia_auto',
                    'observacion': 'Recuperación',
                }
            )

            if created:
                creados += 1
            else:
                actualizados += 1

        return creados, actualizados

    @classmethod
    @transaction.atomic
    def crear_manual(cls, data: dict) -> HoraTrabajada:
        """
        Crea un registro manual de hora trabajada.

        Valida:
        - Profesor activo
        - Fecha no futura
        - horas_trabajadas > 0
        - horario obligatorio (siempre 'clase_regular')
        - El profesor corresponde al horario

        Args:
            data: Diccionario con los datos del registro

        Returns:
            HoraTrabajada: Instancia creada

        Raises:
            ValueError: Si alguna validación falla
        """
        if not data.get('horario'):
            raise ValueError("El horario es obligatorio.")

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

        # Convertir ciclo de ID a instancia si es necesario
        ciclo_value = data.get('ciclo')
        if isinstance(ciclo_value, Ciclo):
            ciclo = ciclo_value
        else:
            try:
                ciclo = Ciclo.objects.get(id=ciclo_value)
            except Ciclo.DoesNotExist:
                raise ValueError("Ciclo no encontrado.")

        # Convertir horario de ID a instancia si es necesario
        horario_value = data.get('horario')
        if horario_value is None:
            raise ValueError("El horario es obligatorio.")
        elif isinstance(horario_value, Horario):
            horario = horario_value
        else:
            try:
                horario = Horario.objects.get(id=horario_value)
            except Horario.DoesNotExist:
                raise ValueError("Horario no encontrado.")

        # Validar que el profesor corresponda al horario
        if horario.profesor_id != profesor.id:
            raise ValueError(
                f"El horario pertenece a {horario.profesor.nombre}, no a {profesor.nombre}."
            )

        fecha = data.get('fecha')
        if fecha and fecha > date.today():
            raise ValueError("La fecha no puede ser futura.")

        horas_trabajadas = data.get('horas_trabajadas', 0)
        if horas_trabajadas <= 0:
            raise ValueError("Las horas trabajadas deben ser mayores a 0.")

        config_snapshot = cls._get_config_snapshot()

        # Monto manual: el admin decide el valor
        monto_profesor = data.get('monto_profesor')
        if monto_profesor is None or monto_profesor <= 0:
            raise ValueError("El monto del profesor es obligatorio para registros manuales.")

        try:
            ht = HoraTrabajada.objects.create(
                profesor=profesor,
                ciclo=ciclo,
                horario=horario,
                fecha=fecha,
                tipo='clase_regular',
                horas_trabajadas=horas_trabajadas,
                estado='aprobada',
                num_alumnos=0,
                valor_generado=monto_profesor,
                monto_base=Decimal('0.00'),
                monto_adicional=Decimal('0.00'),
                monto_profesor=monto_profesor,
                ganancia_taller=Decimal('0.00'),
                config_snapshot=config_snapshot,
                observacion=data.get('observacion', ''),
                created_from='admin_manual',
            )
        except IntegrityError:
            raise ValueError(
                "Ya existe un registro para este profesor, horario, fecha y tipo. "
                "Si desea modificarlo, edite el registro existente."
            )

        return ht
