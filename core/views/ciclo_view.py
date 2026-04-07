from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Ciclo
from ..serializers import CicloSerializer, CicloListSerializer
from .pagination import StandardResultsSetPagination


class CicloViewSet(viewsets.ModelViewSet):
    queryset = Ciclo.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'activo']
    search_fields = ['nombre']
    ordering_fields = ['nombre', 'fecha_inicio', 'fecha_fin']
    ordering = ['-fecha_inicio']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return CicloListSerializer
        return CicloSerializer
