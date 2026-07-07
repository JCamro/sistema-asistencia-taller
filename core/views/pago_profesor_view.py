from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from django.db.models import Count, Prefetch
from django.db.models.functions import ExtractMonth
from decimal import Decimal
from datetime import datetime

from ..models import PagoProfesor, PagoProfesorDetalle, Profesor, Ciclo
from ..serializers import PagoProfesorSerializer, PagoProfesorListSerializer, PagoProfesorDetalleSerializer
from ..services import PagoProfesorService
from .pagination import StandardResultsSetPagination


class PagoProfesorViewSet(viewsets.ModelViewSet):
    queryset = PagoProfesor.objects.select_related('profesor', 'ciclo').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'estado', 'profesor', 'fecha_inicio', 'fecha_fin']
    search_fields = ['profesor__nombre', 'profesor__apellido']
    ordering_fields = ['created_at', 'monto_final']
    ordering = ['-created_at']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        # Solo prefetch detalles para retrieve/detalles (no en list)
        if self.action in ('retrieve', 'detalles'):
            qs = qs.prefetch_related(
                Prefetch(
                    'detalles',
                    queryset=PagoProfesorDetalle.objects.select_related(
                        'horario__taller', 'pago_profesor__profesor'
                    )
                )
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return PagoProfesorListSerializer
        return PagoProfesorSerializer

    @action(detail=True, methods=['get'])
    def detalles(self, request, pk=None):
        pago = self.get_object()
        # sorted() usa el prefetch cache; .order_by() lo ignoraría
        detalles = sorted(pago.detalles.all(), key=lambda d: d.fecha, reverse=True)
        serializer = PagoProfesorDetalleSerializer(detalles, many=True)
        return Response({'detalles': serializer.data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calcular_pago_profesor(request):
    ciclo_id = request.data.get('ciclo_id')
    fecha_inicio = request.data.get('fecha_inicio')
    fecha_fin = request.data.get('fecha_fin')
    regenerar_horas = str(request.data.get('regenerar_horas', 'true')).lower() == 'true'

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

    # Delegar al servicio (regenerar_horas controla si se regeneran las horas trabajadas)
    resultados = PagoProfesorService.calcular_periodo(
        ciclo, fecha_inicio, fecha_fin,
        regenerar_horas=regenerar_horas
    )
    return Response(resultados)


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
        resultado = PagoProfesorService.detalle_clase(int(horario_id), fecha, int(profesor_id) if profesor_id else None)
        return Response(resultado)
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_404_NOT_FOUND
        )


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

    from ..models import Recibo, Egreso
    from django.db.models import Sum

    # === INGRESOS (1 query combinada) ===
    recibos_data = Recibo.objects.filter(
        ciclo=ciclo,
        estado='pagado'
    ).aggregate(total=Sum('monto_pagado'), count=Count('id'))
    ingreso_bruto = recibos_data['total'] or Decimal('0.00')
    num_recibos = recibos_data['count'] or 0

    # === EGRESOS (gasto_taller + gasto_personal + pago_profesor legacy) ===
    egresos_por_tipo = Egreso.objects.filter(
        ciclo=ciclo,
        estado__in=['pendiente', 'cancelado'],
        tipo__in=['gasto_taller', 'gasto_personal', 'pago_profesor']
    ).values('tipo').annotate(total=Sum('monto'))
    egreso_map = {e['tipo']: e['total'] for e in egresos_por_tipo}
    gasto_taller = egreso_map.get('gasto_taller', Decimal('0.00'))
    # Fusionar pago_profesor (legacy) con gasto_personal
    gasto_personal = egreso_map.get('gasto_personal', Decimal('0.00')) + egreso_map.get('pago_profesor', Decimal('0.00'))

    total_egresos = gasto_taller + gasto_personal

    # Ganancia neta
    ingreso_neto = ingreso_bruto - total_egresos

    # Calcular percentages
    porcentaje_egresos = float(total_egresos / ingreso_bruto * 100) if ingreso_bruto > 0 else 0
    porcentaje_ganancia = float(ingreso_neto / ingreso_bruto * 100) if ingreso_bruto > 0 else 0

    # Ticket promedio (ingresos / numero de recibos)
    ticket_promedio = float(ingreso_bruto / num_recibos) if num_recibos > 0 else 0

    return Response({
        'ciclo': ciclo.nombre,
        'balance': {
            'total_ingresos': float(ingreso_bruto),
            'total_egresos': float(total_egresos),
            'ganancia_neta': float(ingreso_neto),
            'porcentaje_egresos': porcentaje_egresos,
            'porcentaje_ganancia': porcentaje_ganancia,
            'ticket_promedio': ticket_promedio,
        },
        'ingresos': {
            'recibos_pagados': float(ingreso_bruto),
            'num_recibos': num_recibos,
        },
        'egresos': {
            'gasto_taller': float(gasto_taller),
            'gasto_personal': float(gasto_personal),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resumen_mensual_ciclo(request, pk):
    """Resumen mensual de ingresos y egresos por mes"""
    try:
        ciclo = Ciclo.objects.get(pk=pk)
    except Ciclo.DoesNotExist:
        return Response(
            {'error': 'Ciclo no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    from ..models import Recibo, Egreso
    from django.db.models import Sum, Count
    from django.db.models.functions import ExtractMonth, ExtractYear

    # Ingresos por mes (recibos pagados)
    ingresos_mensuales = Recibo.objects.filter(
        ciclo=ciclo,
        estado='pagado'
    ).annotate(
        año=ExtractYear('fecha_emision'),
        mes=ExtractMonth('fecha_emision')
    ).values('año', 'mes').annotate(
        total=Sum('monto_pagado'),
        cantidad=Count('id')
    ).order_by('año', 'mes')

    # Egresos por mes (cancelados)
    egresos_mensuales = Egreso.objects.filter(
        ciclo=ciclo,
        estado__in=['pendiente', 'cancelado']
    ).annotate(
        año=ExtractYear('fecha'),
        mes=ExtractMonth('fecha')
    ).values('año', 'mes').annotate(
        total=Sum('monto')
    ).order_by('año', 'mes')

    # Convertir a diccionario por (año, mes)
    ingresos_por_mes = {(item['año'], item['mes']): {'ingresos': float(item['total'] or 0), 'recibos': item['cantidad']} for item in ingresos_mensuales}
    egresos_por_mes = {(item['año'], item['mes']): float(item['total'] or 0) for item in egresos_mensuales}

    # Obtener todos los meses del ciclo como (año, mes)
    meses_cycle = []
    if ciclo.fecha_inicio and ciclo.fecha_fin:
        from datetime import date
        current = ciclo.fecha_inicio
        while current <= ciclo.fecha_fin:
            meses_cycle.append((current.year, current.month))
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)

    # Construir respuesta
    meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    resultado = []
    seen = set()
    for año, mes in meses_cycle:
        if (año, mes) in seen:
            continue
        seen.add((año, mes))
        data = ingresos_por_mes.get((año, mes), {'ingresos': 0, 'recibos': 0})
        ingresos = data['ingresos']
        egresos = egresos_por_mes.get((año, mes), 0)
        resultado.append({
            'año': año,
            'mes': mes,
            'nombre': f"{meses_nombres[mes]} {año}",
            'ingresos': ingresos,
            'egresos': egresos,
            'balance': ingresos - egresos,
            'recibos': data['recibos'],
        })

    return Response(resultado)
