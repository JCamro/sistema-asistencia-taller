from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Prefetch, Count, Q
from ..models import Horario, MatriculaHorario
from ..serializers import HorarioSerializer, HorarioListSerializer
from .pagination import StandardResultsSetPagination


class HorarioViewSet(viewsets.ModelViewSet):
    queryset = Horario.objects.select_related('ciclo', 'taller', 'profesor').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'taller', 'profesor', 'dia_semana', 'activo']
    search_fields = ['taller__nombre', 'profesor__nombre', 'profesor__apellido']
    ordering_fields = ['dia_semana', 'hora_inicio']
    ordering = ['dia_semana', 'hora_inicio']
    # Sin paginación para endpoint nested — dropdown necesita todos los horarios
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return HorarioListSerializer
        return HorarioSerializer

    def get_queryset(self):
        from django.db.models import Prefetch
        
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(ciclo_id=ciclo_id)
        
        # Prefetch alumnos data to avoid N+1 queries
        active_matriculas = MatriculaHorario.objects.filter(
            matricula__activo=True,
            matricula__concluida=False
        ).select_related('matricula__alumno')
        
        queryset = queryset.prefetch_related(
            Prefetch('matricula_horarios', queryset=active_matriculas)
        ).annotate(
            ocupacion=Count(
                'matricula_horarios',
                filter=Q(matricula_horarios__matricula__activo=True,
                         matricula_horarios__matricula__concluida=False)
            )
        )
        
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
