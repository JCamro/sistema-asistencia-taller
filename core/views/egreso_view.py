from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from django.db import connection
import logging

from ..models import Egreso
from ..serializers import EgresoSerializer, EgresoListSerializer

logger = logging.getLogger(__name__)


class EgresoViewSet(viewsets.ModelViewSet):
    queryset = Egreso.objects.select_related('ciclo', 'profesor').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'tipo', 'estado']
    search_fields = ['descripcion', 'beneficiario']
    ordering_fields = ['fecha', 'monto', 'id']
    ordering = ['-fecha', '-id']

    def get_serializer_class(self):
        if hasattr(self, 'action') and self.action == 'list':
            return EgresoListSerializer
        return EgresoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        logger.debug(f"EgresoViewSet.get_queryset called with kwargs: {getattr(self, 'kwargs', {})}")
        ciclo_id = self.kwargs.get('ciclo_id') if hasattr(self, 'kwargs') and self.kwargs else None
        logger.debug(f"ciclo_id: {ciclo_id}")
        if ciclo_id:
            queryset = queryset.filter(ciclo_id=ciclo_id)
            logger.debug(f"Filtered queryset count: {queryset.count()}")
        return queryset

    def create(self, request, *args, **kwargs):
        ciclo_id = self.kwargs.get('ciclo_id')
        if not ciclo_id:
            return super().create(request, *args, **kwargs)

        data = request.data.copy()
        data['ciclo'] = ciclo_id

        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def resumen(self, request, ciclo_id=None):
        """Resumen de egresos por tipo para un ciclo"""
        try:
            ciclo_id = self.kwargs.get('ciclo_id')
            logger.debug(f"resumen called with ciclo_id: {ciclo_id}")
            if not ciclo_id:
                return Response(
                    {'error': 'Se requiere especificar el ciclo'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Todos los egresos (pendiente y cancelado)
            egresos = Egreso.objects.filter(
                ciclo_id=ciclo_id
            )
            logger.debug(f"egresos count: {egresos.count()}")

            resumen = egresos.values('tipo').annotate(
                total=Sum('monto')
            )
            logger.debug(f"resumen query: {resumen.query}")

            resultados = {
                'gasto_taller': 0,
                'pago_profesor': 0,
                'gasto_personal': 0,
                'total': 0
            }

            for item in resumen:
                tipo = item['tipo']
                monto = float(item['total'] or 0)
                if tipo == 'gasto_taller':
                    resultados['gasto_taller'] = monto
                elif tipo == 'pago_profesor':
                    resultados['pago_profesor'] = monto
                elif tipo == 'gasto_personal':
                    resultados['gasto_personal'] = monto
                resultados['total'] += monto

            logger.debug(f"resultados: {resultados}")
            return Response(resultados, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in resumen: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='historial-pagos')
    def historial_pagos(self, request, profesor_id=None):
        """Historial de pagos de un profesor"""
        profesor_id = self.kwargs.get('profesor_id')
        if not profesor_id:
            return Response(
                {'error': 'Se requiere especificar el profesor'},
                status=status.HTTP_400_BAD_REQUEST
            )

        egresos = Egreso.objects.filter(
            profesor_id=profesor_id,
            tipo__in=['pago_profesor', 'adelanto_profesor']
        ).select_related('ciclo')

        serializer = EgresoListSerializer(egresos, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
