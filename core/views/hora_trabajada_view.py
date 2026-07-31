from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import IntegrityError, transaction
from django_filters.rest_framework import DjangoFilterBackend

from ..models import HoraTrabajada, Profesor
from ..serializers import (
    HoraTrabajadaListSerializer,
    HoraTrabajadaDetailSerializer,
    HoraTrabajadaCreateUpdateSerializer,
)
from ..services import HoraTrabajadaService
from .pagination import StandardResultsSetPagination


class HoraTrabajadaViewSet(viewsets.ModelViewSet):
    queryset = HoraTrabajada.objects.select_related(
        'profesor', 'ciclo', 'horario__taller', 'horario__profesor'
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

    @action(detail=True, methods=['patch'], url_path='reassign')
    def reassign(self, request, pk=None):
        """Reasigna el profesor de una HoraTrabajada existente."""
        hora = self.get_object()
        profesor_id = request.data.get('profesor')
        if profesor_id is None:
            return Response(
                {"detail": "El campo 'profesor' es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            nuevo_profesor = Profesor.objects.get(id=profesor_id, activo=True)
        except (Profesor.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Profesor no encontrado o inactivo."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                hora.profesor = nuevo_profesor
                hora.save(update_fields=['profesor', 'updated_at'])
        except IntegrityError:
            return Response(
                {
                    "detail": "Ya existe un registro para este profesor en esta fecha y horario."
                },
                status=status.HTTP_409_CONFLICT
            )

        serializer = HoraTrabajadaDetailSerializer(hora, context={'request': request})
        return Response(serializer.data)
