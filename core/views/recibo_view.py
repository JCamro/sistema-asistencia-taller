from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Prefetch, Sum, Q
from ..models import Recibo, ReciboMatricula
from ..serializers import ReciboSerializer, ReciboListSerializer
from .pagination import StandardResultsSetPagination
import logging

logger = logging.getLogger(__name__)


class ReciboViewSet(viewsets.ModelViewSet):
    queryset = Recibo.objects.select_related('alumno', 'ciclo').prefetch_related(
        Prefetch(
            'matriculas',
            queryset=ReciboMatricula.objects.select_related('matricula__alumno', 'matricula__taller')
        )
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'estado', 'paquete_aplicado']
    search_fields = ['numero', 'alumno__nombre', 'alumno__apellido', 'matriculas__matricula__alumno__nombre', 'matriculas__matricula__alumno__apellido']
    ordering_fields = ['fecha_emision', 'monto_total', 'id']
    ordering = ['-id']

    def get_serializer_class(self):
        if self.action == 'list':
            return ReciboListSerializer
        return ReciboSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(ciclo_id=ciclo_id)

        # Date filters for recibos
        fecha = self.request.query_params.get('fecha')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')

        if fecha:
            queryset = queryset.filter(fecha_emision=fecha)
        if fecha_desde:
            queryset = queryset.filter(fecha_emision__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_emision__lte=fecha_hasta)

        # When searching through matriculas (multi-student), avoid duplicates
        if self.request.query_params.get('search'):
            queryset = queryset.distinct()
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

    @action(detail=False, methods=['get'], url_path='totals')
    def totals(self, request, ciclo_id=None):
        filters = {}
        if ciclo_id:
            filters['ciclo_id'] = ciclo_id
        aggregates = Recibo.objects.filter(**filters).aggregate(
            total=Sum('monto_total'),
            pagado=Sum('monto_pagado', filter=Q(estado='pagado')),
            pendiente=Sum('monto_total', filter=Q(estado='pendiente')),
        )
        return Response({
            'total': aggregates['total'] or 0,
            'pagado': aggregates['pagado'] or 0,
            'pendiente': aggregates['pendiente'] or 0,
        })

    @action(detail=True, methods=['patch'])
    def marcar_pagado(self, request, pk=None):
        recibo = self.get_object()
        monto = request.data.get('monto')

        if monto:
            try:
                monto = float(monto)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Monto inválido'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            recibo.monto_pagado = monto

        if recibo.monto_pagado >= recibo.monto_total:
            recibo.estado = 'pagado'

        recibo.save()
        serializer = self.get_serializer(recibo)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def editar_precio(self, request, pk=None):
        recibo = self.get_object()
        monto_total = request.data.get('monto_total')

        if monto_total is None:
            return Response(
                {'error': 'Se requiere el campo monto_total'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            monto_total = float(monto_total)
        except (ValueError, TypeError):
            return Response(
                {'error': 'Monto inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        recibo.monto_total = monto_total
        recibo.precio_editado = True
        recibo.descuento = recibo.monto_bruto - monto_total
        recibo.save()

        serializer = self.get_serializer(recibo)
        return Response(serializer.data)
