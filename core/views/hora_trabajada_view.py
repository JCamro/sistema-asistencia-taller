from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime

from ..models import HoraTrabajada, Ciclo
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
    filterset_fields = {
        'ciclo': ['exact'],
        'profesor': ['exact'],
        'tipo': ['exact'],
        'estado': ['exact'],
        'fecha': ['exact', 'gte', 'lte'],
    }
    search_fields = ['profesor__nombre', 'profesor__apellido', 'observacion']
    ordering_fields = ['fecha', 'created_at', 'monto_profesor']
    ordering = ['-fecha']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return HoraTrabajadaListSerializer
        elif self.action in ('create', 'partial_update', 'update'):
            return HoraTrabajadaCreateUpdateSerializer
        return HoraTrabajadaDetailSerializer

    def perform_create(self, serializer):
        # Delegar al servicio para validaciones de negocio
        data = serializer.validated_data
        instance = HoraTrabajadaService.crear_manual(data)
        return instance

    def update(self, request, *args, **kwargs):
        # Solo permitir actualizar registros pendientes
        instance = self.get_object()
        if instance.estado != 'pendiente':
            return Response(
                {'error': f"No se puede modificar un registro en estado "
                          f"'{instance.get_estado_display()}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.estado != 'pendiente':
            return Response(
                {'error': f"No se puede eliminar un registro en estado '{instance.get_estado_display()}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'])
    def aprobar(self, request, pk=None):
        """
        Aprueba un registro pendiente.
        PATCH /api/horas-trabajadas/{id}/aprobar/
        """
        instance = self.get_object()
        try:
            HoraTrabajadaService.aprobar(instance)
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['patch'])
    def rechazar(self, request, pk=None):
        """
        Rechaza un registro pendiente.
        PATCH /api/horas-trabajadas/{id}/rechazar/
        """
        instance = self.get_object()
        try:
            HoraTrabajadaService.rechazar(instance)
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['post'])
    def generar(self, request):
        """
        Genera horas trabajadas desde asistencias para un período.
        POST /api/horas-trabajadas/generar/
        """
        ciclo_id = request.data.get('ciclo_id')
        fecha_inicio = request.data.get('fecha_inicio')
        fecha_fin = request.data.get('fecha_fin')

        if not ciclo_id:
            return Response(
                {'error': 'Se requiere ciclo_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not fecha_inicio or not fecha_fin:
            return Response(
                {'error': 'Se requiere fecha_inicio y fecha_fin'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ciclo = Ciclo.objects.get(id=ciclo_id)
            fecha_inicio = datetime.strptime(fecha_inicio, '%Y-%m-%d').date()
            fecha_fin = datetime.strptime(fecha_fin, '%Y-%m-%d').date()
        except Ciclo.DoesNotExist:
            return Response(
                {'error': 'Ciclo no encontrado'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError:
            return Response(
                {'error': 'Formato de fecha inválido. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        resultados = HoraTrabajadaService.generar_horas_trabajadas(
            ciclo, fecha_inicio, fecha_fin
        )
        return Response(resultados)
