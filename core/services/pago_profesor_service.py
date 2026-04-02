"""
Servicio para la lógica de negocio de Pagos a Profesores.

Maneja los cálculos de pagos por período y por clase,
utilizando la fórmula configurada en core.constants.
"""
from datetime import date
from decimal import Decimal

from django.db import transaction

from ..models import Asistencia, PagoProfesor, PagoProfesorDetalle, Profesor
from ..constants import BASE_PAGO, TOPE_MAXIMO, PORCENTAJE_ADICIONAL


class PagoProfesorService:
    """Servicio para manejar la lógica de negocio de Pagos a Profesores."""

    @classmethod
    @transaction.atomic
    def calcular_periodo(cls, ciclo, fecha_inicio: date, fecha_fin: date) -> dict:
        """
        Calcula los pagos a todos los profesores para un período determinado.
        
        Limpia los datos anteriores del período y recalcula desde cero.
        
        Args:
            ciclo: Instancia del Ciclo
            fecha_inicio: Fecha de inicio del período
            fecha_fin: Fecha de fin del período
            
        Returns:
            dict: Resultados con información del cálculo por profesor
        """
        # Limpiar datos anteriores del período
        PagoProfesorDetalle.objects.filter(
            pago_profesor__ciclo=ciclo,
            fecha__gte=fecha_inicio,
            fecha__lte=fecha_fin
        ).delete()
        
        PagoProfesor.objects.filter(
            ciclo=ciclo,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin
        ).delete()

        profesores = Profesor.objects.filter(activo=True, es_gerente=False)

        resultados = []
        for profesor in profesores:
            # Get unique (horario_id, fecha) combinations for this professor
            # Convert to native tuples + dict dedup for maximum reliability
            clases_raw = list(dict.fromkeys(
                (int(r[0]), r[1]) for r in Asistencia.objects.filter(
                    horario__ciclo=ciclo,
                    profesor=profesor,
                    estado='asistio',
                    fecha__gte=fecha_inicio,
                    fecha__lte=fecha_fin
                ).values_list('horario_id', 'fecha')
            ))
            
            total_clases = len(clases_raw)
            
            if total_clases == 0:
                continue
            
            total_alumnos = 0
            monto_total_profesor = Decimal('0.00')
            monto_total_ganancia = Decimal('0.00')

            pago = PagoProfesor.objects.create(
                profesor=profesor,
                ciclo=ciclo,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                horas_calculadas=total_clases,
                monto_calculado=Decimal('0.00'),
                monto_final=Decimal('0.00'),
                total_alumnos_asistencias=0,
                ganancia_taller=Decimal('0.00'),
                estado='calculado'
            )

            for horario_id, fecha in clases_raw:
                # Cargar el horario para conocer el tipo de pago
                from ..models import Horario
                try:
                    horario = Horario.objects.get(id=horario_id)
                except Horario.DoesNotExist:
                    continue
                
                asistentes = Asistencia.objects.filter(
                    horario_id=horario_id,
                    fecha=fecha,
                    profesor=profesor,
                    estado='asistio'
                ).select_related('matricula', 'horario')

                num_alumnos = asistentes.count()
                total_alumnos += num_alumnos

                # Calcular pago por clase (pasar el horario para tipo de pago)
                resultado_clase = cls._calcular_pago_clase(asistentes, num_alumnos, horario)
                monto_profesor = resultado_clase['monto_profesor']
                monto_adicional = resultado_clase['monto_adicional']

                valor_generado = sum(
                    (a.matricula.precio_por_sesion or Decimal('0.00'))
                    for a in asistentes
                )
                ganancia_taller = valor_generado - monto_profesor

                PagoProfesorDetalle.objects.update_or_create(
                    pago_profesor=pago,
                    horario_id=horario_id,
                    fecha=fecha,
                    defaults={
                        'num_alumnos': num_alumnos,
                        'valor_generado': float(valor_generado),
                        'monto_base': BASE_PAGO if num_alumnos > 0 else Decimal('0.00'),
                        'monto_adicional': monto_adicional,
                        'monto_profesor': monto_profesor,
                        'ganancia_taller': ganancia_taller
                    }
                )

                monto_total_profesor += monto_profesor
                monto_total_ganancia += ganancia_taller

            pago.monto_calculado = monto_total_profesor
            pago.monto_final = monto_total_profesor
            pago.total_alumnos_asistencias = total_alumnos
            pago.ganancia_taller = monto_total_ganancia
            pago.save()

            resultados.append({
                'profesor_id': profesor.id,
                'profesor': f"{profesor.apellido}, {profesor.nombre}",
                'pago_id': pago.id,
                'clases_dictadas': total_clases,
                'total_alumnos_asistencias': total_alumnos,
                'monto_profesor': float(monto_total_profesor),
                'ganancia_taller': float(monto_total_ganancia)
            })

        return {
            'ciclo': ciclo.nombre,
            'fecha_inicio': fecha_inicio.isoformat(),
            'fecha_fin': fecha_fin.isoformat(),
            'resultados': resultados
        }

    @classmethod
    def _calcular_pago_clase(cls, asistentes, num_alumnos: int, horario=None) -> dict:
        """
        Calcula el pago a un profesor para una clase específica.
        
        Fórmula dinámica:
        - 0 alumnos → S/. 0.00
        - 1 alumno → S/. 17.00 fijo
        - 2+ alumnos → S/. 17.00 base + 50% del valor de sesión de cada alumno adicional
        - Tope → Máx S/. 35.00 por clase (excedente = ganancia del taller)
        
        Fórmula fija:
        - 0 alumnos → S/. 0.00
        - 1+ alumnos → monto_fijo del horario (o BASE_PAGO si no está configurado)
        
        Args:
            asistentes: QuerySet de Asistencia con los alumnos asistentes
            num_alumnos: Número de alumnos que asistieron
            horario: Objeto Horario (opcional) para determinar tipo de pago
            
        Returns:
            dict: Diccionario con monto_profesor y monto_adicional
        """
        # Verificar si es pago fijo
        es_pago_fijo = horario and getattr(horario, 'tipo_pago', 'dinamico') == 'fijo'
        
        if num_alumnos == 0:
            return {
                'monto_profesor': Decimal('0.00'),
                'monto_adicional': Decimal('0.00')
            }
        
        if es_pago_fijo:
            # Pago fijo: sin importar la cantidad de alumnos (al menos 1)
            monto_fijo = getattr(horario, 'monto_fijo', None)
            if monto_fijo is not None:
                monto_profesor = Decimal(str(monto_fijo))
            else:
                monto_profesor = BASE_PAGO  # Default si no hay monto_fijo configurado
            return {
                'monto_profesor': monto_profesor,
                'monto_adicional': monto_profesor - BASE_PAGO
            }
        
        # Pago dinámico (lógica original)
        if num_alumnos == 1:
            return {
                'monto_profesor': BASE_PAGO,
                'monto_adicional': Decimal('0.00')
            }
        else:
            monto_adicional_bruto = Decimal('0.00')
            for asistente in asistentes[1:]:
                valor_sesion = asistente.matricula.precio_por_sesion
                if valor_sesion:
                    monto_adicional_bruto += valor_sesion * PORCENTAJE_ADICIONAL
            monto_total_sin_tope = BASE_PAGO + monto_adicional_bruto
            monto_profesor = min(monto_total_sin_tope, TOPE_MAXIMO)
            # monto_adicional real = lo que efectivamente se suma al base (respeta tope)
            monto_adicional = monto_profesor - BASE_PAGO

            return {
                'monto_profesor': monto_profesor,
                'monto_adicional': monto_adicional
            }

    @classmethod
    def detalle_clase(cls, horario_id: int, fecha: str, profesor_id: int = None) -> dict:
        """
        Obtiene el detalle del pago de una clase específica.
        
        Args:
            horario_id: ID del horario
            fecha: Fecha de la clase (string YYYY-MM-DD)
            profesor_id: ID del profesor (opcional)
            
        Returns:
            dict: Detalle con información de alumnos y resumen de pagos
        """
        from ..models import Horario
        
        try:
            horario = Horario.objects.select_related('taller').get(id=horario_id)
        except Horario.DoesNotExist:
            raise ValueError("Horario no encontrado")

        filtros = {
            'horario_id': horario_id,
            'fecha': fecha,
            'estado': 'asistio'
        }
        if profesor_id:
            filtros['profesor_id'] = profesor_id

        asistentes = Asistencia.objects.filter(
            **filtros
        ).select_related('matricula__alumno', 'horario').order_by('id')

        num_alumnos = asistentes.count()
        
        # Verificar si es pago fijo
        es_pago_fijo = getattr(horario, 'tipo_pago', 'dinamico') == 'fijo'
        
        # Calcular usando la fórmula según tipo de pago
        if num_alumnos == 0:
            monto_profesor = Decimal('0.00')
            monto_base = Decimal('0.00')
            monto_adicional = Decimal('0.00')
            valor_generado = Decimal('0.00')
            aportes_por_alumno = []
        elif es_pago_fijo:
            # Pago fijo
            monto_fijo = getattr(horario, 'monto_fijo', None)
            if monto_fijo is not None:
                monto_profesor = Decimal(str(monto_fijo))
            else:
                monto_profesor = BASE_PAGO
            monto_base = BASE_PAGO
            monto_adicional = monto_profesor - BASE_PAGO
            valor_generado = sum(
                Decimal(str(a.matricula.precio_por_sesion or 0)) for a in asistentes
            )
            # En pago fijo, el monto se divide entre los alumnos presentes
            if num_alumnos > 0:
                aporte_por_alumno = (monto_profesor / num_alumnos).quantize(Decimal('0.01'))
                aportes_por_alumno = [aporte_por_alumno] * num_alumnos
            else:
                aportes_por_alumno = []
        elif num_alumnos == 1:
            monto_base = BASE_PAGO
            monto_adicional = Decimal('0.00')
            monto_profesor = BASE_PAGO
            valor_generado = Decimal(str(asistentes.first().matricula.precio_por_sesion or 0))
            aportes_por_alumno = [BASE_PAGO]
        else:
            monto_base = BASE_PAGO
            valor_generado = Decimal('0.00')
            aportes_brutos = []  # 50% de cada alumno adicional (sin tope)

            for i, asistencia in enumerate(asistentes):
                valor_sesion = Decimal(str(asistencia.matricula.precio_por_sesion or 0))
                valor_generado += valor_sesion
                if i > 0:
                    aportes_brutos.append(valor_sesion * PORCENTAJE_ADICIONAL)

            adicional_bruto = sum(aportes_brutos)
            monto_total_sin_tope = BASE_PAGO + adicional_bruto
            monto_profesor = min(monto_total_sin_tope, TOPE_MAXIMO)
            monto_adicional = monto_profesor - BASE_PAGO

            # Primer alumno aporta la base completa
            aportes_por_alumno = [BASE_PAGO]
            # Alumnos adicionales: distribuir el adicional real proporcionalmente
            if adicional_bruto > 0 and monto_adicional > 0:
                factor = monto_adicional / adicional_bruto
                for bruto in aportes_brutos:
                    aportes_por_alumno.append((bruto * factor).quantize(Decimal('0.01')))
            else:
                aportes_por_alumno.extend([Decimal('0.00')] * len(aportes_brutos))

        ganancia_taller = valor_generado - monto_profesor

        # Construir lista de alumnos
        alumnos_data = []
        for i, asistencia in enumerate(asistentes):
            matricula = asistencia.matricula
            precio_sesion = matricula.precio_por_sesion or 0
            es_adicional = i > 0
            aporte = aportes_por_alumno[i] if i < len(aportes_por_alumno) else Decimal('0.00')

            alumnos_data.append({
                'alumno_id': matricula.alumno.id,
                'alumno_nombre': f"{matricula.alumno.apellido}, {matricula.alumno.nombre}",
                'precio_sesion': float(precio_sesion),
                'es_adicional': es_adicional,
                'aporte_profesor': float(aporte),
                'aporte_generado': float(precio_sesion)
            })

        return {
            'horario_info': f"{horario.taller.nombre} - {horario.get_dia_semana_display()} {horario.hora_inicio.strftime('%H:%M')}-{horario.hora_fin.strftime('%H:%M')}",
            'fecha': fecha,
            'alumnos': alumnos_data,
            'resumen': {
                'num_alumnos': num_alumnos,
                'valor_total_generado': float(valor_generado),
                'monto_base': float(monto_base),
                'monto_adicional': float(monto_adicional),
                'monto_profesor': float(monto_profesor),
                'ganancia_taller': float(ganancia_taller)
            }
        }
