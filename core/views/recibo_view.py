from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Prefetch
from ..models import Recibo, ReciboMatricula
from ..serializers import ReciboSerializer, ReciboListSerializer, CalcularPrecioSerializer
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
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'estado', 'paquete_aplicado']
    search_fields = ['numero', 'alumno__nombre', 'alumno__apellido']
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

    @action(detail=False, methods=['post'])
    def calcular_precio(self, request):
        serializer = CalcularPrecioSerializer(data=request.data)
        if serializer.is_valid():
            resultado = serializer.calcular()
            return Response(resultado, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
