from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from ..models import HoraTrabajada
from ..serializers import (
    HoraTrabajadaListSerializer,
    HoraTrabajadaDetailSerializer,
    HoraTrabajadaCreateUpdateSerializer,
)
from ..services import HoraTrabajadaService
from .pagination import StandardResultsSetPagination


class HoraTrabajadaViewSet(viewsets.ModelViewSet):
    queryset = HoraTrabajada.objects.select_related(
        'profesor', 'ciclo', 'horario__taller'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'profesor', 'horario__taller']
    search_fields = ['profesor__nombre', 'profesor__apellido', 'observacion']
    ordering_fields = ['fecha', 'created_at', 'monto_profesor']
    ordering = ['-fecha']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        # Filtro de fecha manual (más confiable que django-filter para gte/lte)
        desde = self.request.query_params.get('fecha__gte') or self.request.query_params.get('desde')
        hasta = self.request.query_params.get('fecha__lte') or self.request.query_params.get('hasta')
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return HoraTrabajadaListSerializer
        elif self.action in ('create', 'partial_update', 'update'):
            return HoraTrabajadaCreateUpdateSerializer
        return HoraTrabajadaDetailSerializer

    def perform_create(self, serializer):
        data = serializer.validated_data
        instance = HoraTrabajadaService.crear_manual(data)
        return instance
