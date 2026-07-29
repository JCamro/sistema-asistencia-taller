from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response

from ..models import Nota
from ..serializers import NotaSerializer
from .pagination import StandardResultsSetPagination


class NotaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaSerializer
    queryset = Nota.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['es_recordatorio', 'leida']
    search_fields = ['titulo', 'contenido']
    ordering_fields = ['fecha', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id') or self.request.query_params.get('ciclo_id')
        if ciclo_id:
            qs = qs.filter(ciclo_id=ciclo_id)
        return qs

    def create(self, request, *args, **kwargs):
        ciclo_id = self.kwargs.get('ciclo_id')
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        if ciclo_id:
            data['ciclo'] = ciclo_id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'])
    def no_leidas(self, request, **kwargs):
        """Solo recordatorios no leídos — para la campanita de notificaciones."""
        ciclo_id = kwargs.get('ciclo_id') or request.query_params.get('ciclo_id')
        qs = Nota.objects.filter(es_recordatorio=True, leida=False)
        if ciclo_id:
            qs = qs.filter(ciclo_id=ciclo_id)
        count = qs.count()
        # Solo devolver últimos 10 para el panel de notificaciones
        results = qs.order_by('-fecha_vencimiento', '-created_at')[:10]
        return Response({'count': count, 'results': self.get_serializer(results, many=True).data})

    @action(detail=True, methods=['patch'])
    def marcar_leida(self, request, pk=None):
        nota = self.get_object()
        nota.leida = True
        nota.save(update_fields=['leida'])
        return Response(self.get_serializer(nota).data)

    @action(detail=True, methods=['patch'])
    def marcar_no_leida(self, request, pk=None):
        nota = self.get_object()
        nota.leida = False
        nota.save(update_fields=['leida'])
        return Response(self.get_serializer(nota).data)
