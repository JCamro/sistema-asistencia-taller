from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Profesor
from ..serializers import ProfesorSerializer, ProfesorListSerializer


class ProfesorViewSet(viewsets.ModelViewSet):
    queryset = Profesor.objects.select_related('ciclo').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo', 'es_gerente']
    search_fields = ['nombre', 'apellido', 'dni']
    ordering_fields = ['apellido', 'nombre']
    ordering = ['apellido', 'nombre']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProfesorListSerializer
        return ProfesorSerializer

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
