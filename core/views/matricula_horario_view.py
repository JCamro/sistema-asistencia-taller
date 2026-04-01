from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from ..models import MatriculaHorario
from ..serializers import MatriculaHorarioSerializer, MatriculaHorarioListSerializer


class MatriculaHorarioViewSet(viewsets.ModelViewSet):
    queryset = MatriculaHorario.objects.select_related('matricula__alumno', 'horario__taller', 'horario__profesor').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['matricula', 'horario']
    search_fields = ['matricula__alumno__nombre', 'matricula__alumno__apellido', 'horario__taller__nombre']

    def get_queryset(self):
        queryset = super().get_queryset()
        matricula_id = self.kwargs.get('matricula_id')
        if matricula_id:
            queryset = queryset.filter(matricula_id=matricula_id)
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return MatriculaHorarioListSerializer
        return MatriculaHorarioSerializer
