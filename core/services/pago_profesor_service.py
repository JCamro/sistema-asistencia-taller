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
            # Using set() to ensure uniqueness since Django's distinct() can be unreliable
            clases_raw = list(set(
                Asistencia.objects.filter(
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
                asistentes = Asistencia.objects.filter(
                    horario_id=horario_id,
                    fecha=fecha,
                    profesor=profesor,
                    estado='asistio'
                ).select_related('matricula', 'horario')

                num_alumnos = asistentes.count()
                total_alumnos += num_alumnos

                # Calcular pago por clase
                resultado_clase = cls._calcular_pago_clase(asistentes, num_alumnos)
                monto_profesor = resultado_clase['monto_profesor']
                monto_adicional = resultado_clase['monto_adicional']

                valor_generado = sum(
                    float(a.matricula.precio_por_sesion or 0)
                    for a in asistentes
                )
                ganancia_taller = Decimal(str(valor_generado)) - monto_profesor

                PagoProfesorDetalle.objects.create(
                    pago_profesor=pago,
                    horario_id=horario_id,
                    fecha=fecha,
                    num_alumnos=num_alumnos,
                    valor_generado=valor_generado,
                    monto_base=BASE_PAGO if num_alumnos > 0 else Decimal('0.00'),
                    monto_adicional=monto_adicional,
                    monto_profesor=monto_profesor,
                    ganancia_taller=ganancia_taller
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
    def _calcular_pago_clase(cls, asistentes, num_alumnos: int) -> dict:
        """
        Calcula el pago a un profesor para una clase específica.
        
        Fórmula:
        - 0 alumnos → S/. 0.00
        - 1 alumno → S/. 17.00 fijo
        - 2+ alumnos → S/. 17.00 base + 50% del valor de sesión de cada alumno adicional
        - Tope → Máx S/. 35.00 por clase (excedente = ganancia del taller)
        
        Args:
            asistentes: QuerySet de Asistencia con los alumnos asistentes
            num_alumnos: Número de alumnos que asistieron
            
        Returns:
            dict: Diccionario con monto_profesor y monto_adicional
        """
        if num_alumnos == 0:
            return {
                'monto_profesor': Decimal('0.00'),
                'monto_adicional': Decimal('0.00')
            }
        elif num_alumnos == 1:
            return {
                'monto_profesor': BASE_PAGO,
                'monto_adicional': Decimal('0.00')
            }
        else:
            monto_profesor = BASE_PAGO
            monto_adicional = Decimal('0.00')
            for asistente in asistentes[1:]:
                valor_sesion = asistente.matricula.precio_por_sesion
                if valor_sesion:
                    monto_adicional += valor_sesion * PORCENTAJE_ADICIONAL
            monto_profesor = min(monto_profesor + monto_adicional, TOPE_MAXIMO)
            
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
        
        # Calcular usando la fórmula
        if num_alumnos == 0:
            monto_profesor = Decimal('0.00')
            monto_base = Decimal('0.00')
            monto_adicional = Decimal('0.00')
            valor_generado = Decimal('0.00')
        elif num_alumnos == 1:
            monto_base = BASE_PAGO
            monto_adicional = Decimal('0.00')
            monto_profesor = BASE_PAGO
            valor_generado = Decimal(str(asistentes.first().matricula.precio_por_sesion or 0))
        else:
            monto_base = BASE_PAGO
            monto_adicional = Decimal('0.00')
            valor_generado = Decimal('0.00')
            
            for i, asistencia in enumerate(asistentes):
                valor_sesion = asistencia.matricula.precio_por_sesion or 0
                valor_generado += Decimal(str(valor_sesion))
                if i > 0:
                    monto_adicional += Decimal(str(valor_sesion)) * PORCENTAJE_ADICIONAL
            
            monto_profesor = min(monto_base + monto_adicional, TOPE_MAXIMO)

        ganancia_taller = valor_generado - monto_profesor

        # Construir lista de alumnos
        alumnos_data = []
        for i, asistencia in enumerate(asistentes):
            matricula = asistencia.matricula
            precio_sesion = matricula.precio_por_sesion or 0
            es_adicional = i > 0
            aporte_profesor = Decimal('0.00') if not es_adicional else Decimal(str(precio_sesion)) * PORCENTAJE_ADICIONAL
            
            alumnos_data.append({
                'alumno_id': matricula.alumno.id,
                'alumno_nombre': f"{matricula.alumno.apellido}, {matricula.alumno.nombre}",
                'precio_sesion': float(precio_sesion),
                'es_adicional': es_adicional,
                'aporte_profesor': float(aporte_profesor),
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
