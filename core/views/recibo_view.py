from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Recibo
from ..serializers import ReciboSerializer, ReciboListSerializer


class ReciboViewSet(viewsets.ModelViewSet):
    queryset = Recibo.objects.select_related('alumno', 'ciclo').prefetch_related('matriculas').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'estado']
    search_fields = ['numero', 'alumno__nombre', 'alumno__apellido']
    ordering_fields = ['fecha_emision', 'monto_total']
    ordering = ['-fecha_emision']

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
        if ciclo_id:
            data = request.data.copy()
            data['ciclo'] = ciclo_id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        return super().create(request, *args, **kwargs)

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
