from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models
from django.db.models import Count
from django.db.models.functions import ExtractMonth
from decimal import Decimal
from datetime import datetime

from ..models import PagoProfesor, PagoProfesorDetalle, Profesor, Ciclo
from ..serializers import PagoProfesorSerializer, PagoProfesorListSerializer, PagoProfesorDetalleSerializer
from ..services import PagoProfesorService


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

    # Delegar al servicio
    resultados = PagoProfesorService.calcular_periodo(ciclo, fecha_inicio, fecha_fin)
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

    from ..models import Recibo, PagoProfesor
    from django.conf import settings

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
