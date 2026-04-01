from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from django.db import models
from django.db.models import Count
from django.db.models.functions import ExtractMonth
from decimal import Decimal
from datetime import datetime

from ..models import PagoProfesor, PagoProfesorDetalle, Asistencia, Profesor, Ciclo
from ..serializers import PagoProfesorSerializer, PagoProfesorListSerializer, PagoProfesorDetalleSerializer


class PagoProfesorViewSet(viewsets.ModelViewSet):
    queryset = PagoProfesor.objects.select_related('profesor', 'ciclo').prefetch_related('detalles').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'estado', 'profesor', 'fecha_inicio', 'fecha_fin']
    search_fields = ['profesor__nombre', 'profesor__apellido']
    ordering_fields = ['created_at', 'monto_final']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return PagoProfesorListSerializer
        return PagoProfesorSerializer

    @action(detail=True, methods=['get'])
    def detalles(self, request, pk=None):
        pago = self.get_object()
        detalles = pago.detalles.all().order_by('-fecha')
        serializer = PagoProfesorDetalleSerializer(detalles, many=True)
        return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calcular_pago_profesor(request):
    ciclo_id = request.data.get('ciclo_id')
    fecha_inicio = request.data.get('fecha_inicio')
    fecha_fin = request.data.get('fecha_fin')

    if not ciclo_id:
        return Response(
            {'error': 'Se requiere ciclo_id'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not fecha_inicio or not fecha_fin:
        return Response(
            {'error': 'Se requiere fecha_inicio y fecha_fin'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        ciclo = Ciclo.objects.get(id=ciclo_id)
        fecha_inicio = datetime.strptime(fecha_inicio, '%Y-%m-%d').date()
        fecha_fin = datetime.strptime(fecha_fin, '%Y-%m-%d').date()
    except Ciclo.DoesNotExist:
        return Response(
            {'error': 'Ciclo no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )
    except ValueError:
        return Response(
            {'error': 'Formato de fecha inválido. Use YYYY-MM-DD'},
            status=status.HTTP_400_BAD_REQUEST
        )

    BASE_PAGO = Decimal('17.00')
    TOPE_MAXIMO = Decimal('35.00')
    PORCENTAJE_ADICIONAL = Decimal('0.50')

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
        clases = Asistencia.objects.filter(
            horario__ciclo=ciclo,
            profesor=profesor,
            estado='asistio',
            fecha__gte=fecha_inicio,
            fecha__lte=fecha_fin
        ).values('horario', 'fecha', 'profesor').annotate(
            num_alumnos=Count('id')
        ).distinct()

        total_clases = len(clases)
        
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

        for clase in clases:
            asistentes = Asistencia.objects.filter(
                horario_id=clase['horario'],
                fecha=clase['fecha'],
                profesor=profesor,
                estado='asistio'
            ).select_related('matricula', 'horario')

            num_alumnos = asistentes.count()
            total_alumnos += num_alumnos

            if num_alumnos == 0:
                monto_profesor = Decimal('0.00')
                monto_adicional = Decimal('0.00')
            elif num_alumnos == 1:
                monto_profesor = BASE_PAGO
                monto_adicional = Decimal('0.00')
            else:
                monto_profesor = BASE_PAGO
                monto_adicional = Decimal('0.00')
                for asistente in asistentes[1:]:
                    valor_sesion = asistente.matricula.precio_por_sesion
                    if valor_sesion:
                        monto_adicional += valor_sesion * PORCENTAJE_ADICIONAL
                monto_profesor = min(monto_profesor + monto_adicional, TOPE_MAXIMO)

            valor_generado = sum(
                float(a.matricula.precio_por_sesion or 0)
                for a in asistentes
            )
            ganancia_taller = Decimal(str(valor_generado)) - monto_profesor

            PagoProfesorDetalle.objects.create(
                pago_profesor=pago,
                horario_id=clase['horario'],
                fecha=clase['fecha'],
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

    return Response({
        'ciclo': ciclo.nombre,
        'fecha_inicio': fecha_inicio.isoformat(),
        'fecha_fin': fecha_fin.isoformat(),
        'resultados': resultados
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_clase_pago(request):
    horario_id = request.query_params.get('horario_id')
    fecha = request.query_params.get('fecha')
    profesor_id = request.query_params.get('profesor_id')

    if not horario_id or not fecha:
        return Response(
            {'error': 'Se requiere horario_id y fecha'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        from ..models import Horario, Asistencia
        horario = Horario.objects.select_related('taller').get(id=horario_id)
    except Horario.DoesNotExist:
        return Response(
            {'error': 'Horario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    BASE_PAGO = Decimal('17.00')
    TOPE_MAXIMO = Decimal('35.00')
    PORCENTAJE_ADICIONAL = Decimal('0.50')

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

    return Response({
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
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resumen_ciclo(request, pk):
    try:
        ciclo = Ciclo.objects.get(pk=pk)
    except Ciclo.DoesNotExist:
        return Response(
            {'error': 'Ciclo no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    from ..models import Recibo, PagoProfesor

    ingresos = Recibo.objects.filter(
        ciclo=ciclo,
        estado='pagado'
    ).aggregate(total=models.Sum('monto_pagado'))

    ingreso_bruto = ingresos['total'] or Decimal('0.00')

    egresos = PagoProfesor.objects.filter(
        ciclo=ciclo,
        profesor__es_gerente=False,
        estado__in=['calculado', 'pagado']
    ).aggregate(total=models.Sum('monto_final'))

    egresos_profesores = egresos['total'] or Decimal('0.00')

    ingreso_neto = ingreso_bruto - egresos_profesores

    porcentaje_local = Decimal(str(settings.PORCENTAJE_LOCAL))
    porcentaje_taller = Decimal('100') - porcentaje_local

    porcentaje_local_monto = ingreso_bruto * (porcentaje_local / Decimal('100'))
    porcentaje_taller_monto = ingreso_bruto * (porcentaje_taller / Decimal('100'))

    return Response({
        'ciclo': ciclo.nombre,
        'ingreso_bruto': float(ingreso_bruto),
        'egresos_profesores': float(egresos_profesores),
        'ingreso_neto': float(ingreso_neto),
        'porcentaje_local_40': float(porcentaje_local_monto),
        'porcentaje_taller_60': float(porcentaje_taller_monto)
    })
