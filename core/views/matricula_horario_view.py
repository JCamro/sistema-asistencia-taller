from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import MatriculaHorario
from ..serializers import MatriculaHorarioSerializer, MatriculaHorarioListSerializer


class MatriculaHorarioViewSet(viewsets.ModelViewSet):
    queryset = MatriculaHorario.objects.select_related('matricula__alumno', 'horario__taller', 'horario__profesor').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['matricula', 'horario', 'matricula__ciclo']
    search_fields = ['matricula__alumno__nombre', 'matricula__alumno__apellido', 'horario__taller__nombre']
    http_method_names = ['get', 'post', 'head', 'options']

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

    def create(self, request, *args, **kwargs):
        """Idempotent: si el MatriculaHorario ya existe, devuelve 200 en vez de 400."""
        matricula = request.data.get('matricula')
        horario = request.data.get('horario')

        if matricula and horario:
            existente = MatriculaHorario.objects.filter(matricula=matricula, horario=horario).first()
            if existente:
                serializer = self.get_serializer(existente)
                return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)
