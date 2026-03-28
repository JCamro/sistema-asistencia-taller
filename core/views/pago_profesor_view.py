from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from django.db import models
from django.db.models import Count
from django.db.models.functions import ExtractMonth
from decimal import Decimal

from ..models import PagoProfesor, Asistencia, Profesor, Ciclo
from ..serializers import PagoProfesorSerializer, PagoProfesorListSerializer


class PagoProfesorViewSet(viewsets.ModelViewSet):
    queryset = PagoProfesor.objects.select_related('profesor', 'ciclo').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'estado', 'profesor']
    search_fields = ['profesor__nombre', 'profesor__apellido']
    ordering_fields = ['created_at', 'monto_final']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return PagoProfesorListSerializer
        return PagoProfesorSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calcular_pago_profesor(request):
    ciclo_id = request.data.get('ciclo_id')

    if not ciclo_id:
        return Response(
            {'error': 'Se requiere ciclo_id'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        ciclo = Ciclo.objects.get(id=ciclo_id)
    except Ciclo.DoesNotExist:
        return Response(
            {'error': 'Ciclo no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    profesores = Profesor.objects.filter(activo=True, es_gerente=False)

    resultados = []
    for profesor in profesores:
        asistencias = Asistencia.objects.filter(
            horario__ciclo=ciclo,
            profesor=profesor,
            estado='presente'
        ).values('horario').distinct()

        horas_dictadas = asistentes.count() if (asistentes := asistencias.count()) > 0 else 0

        monto_calculado = Decimal('0.00')

        if horas_dictadas > 0:
            for asistencia_obj in Asistencia.objects.filter(
                horario__ciclo=ciclo,
                profesor=profesor,
                estado='presente'
            ).select_related('matricula', 'horario'):
                precio_session = asistencia_obj.matricula.precio_por_sesion
                monto_calculado += precio_session

        pago, created = PagoProfesor.objects.update_or_create(
            profesor=profesor,
            ciclo=ciclo,
            defaults={
                'horas_calculadas': horas_dictadas,
                'monto_calculado': monto_calculado,
                'monto_final': monto_calculado,
                'estado': 'calculado'
            }
        )

        resultados.append({
            'profesor': f"{profesor.apellido}, {profesor.nombre}",
            'horas': horas_dictadas,
            'monto': float(monto_calculado)
        })

    return Response({
        'ciclo': ciclo.nombre,
        'resultados': resultados
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
