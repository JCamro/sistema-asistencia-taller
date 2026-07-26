from datetime import date
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Profesor, Horario, PagoProfesor
from ..serializers import ProfesorSerializer, ProfesorListSerializer
from .pagination import StandardResultsSetPagination


class ProfesorViewSet(viewsets.ModelViewSet):
    queryset = Profesor.objects.select_related('ciclo').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo', 'es_gerente']
    search_fields = ['nombre', 'apellido', 'dni']
    ordering_fields = ['apellido', 'nombre']
    ordering = ['apellido', 'nombre']
    pagination_class = StandardResultsSetPagination

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

    @action(detail=True, methods=['get'], url_path='detalle')
    def detalle(self, request, pk=None, ciclo_id=None):
        if not ciclo_id:
            return Response({'error': 'Se requiere ciclo_id'}, status=status.HTTP_400_BAD_REQUEST)

        profesor = self.get_object()

        horarios = Horario.objects.filter(
            profesor=profesor,
            ciclo_id=ciclo_id
        ).select_related('taller')

        horarios_data = [{
            'id': h.id,
            'taller': h.taller.nombre,
            'taller_id': h.taller.id,
            'dia': h.get_dia_semana_display(),
            'hora_inicio': str(h.hora_inicio),
            'hora_fin': str(h.hora_fin),
        } for h in horarios]

        # Approximate 12 months ago (1st day of month, 1 year back)
        today = date.today()
        doce_meses_atras = date(today.year - 1, today.month, 1)
        pagos = PagoProfesor.objects.filter(
            profesor=profesor,
            ciclo_id=ciclo_id,
            fecha_inicio__gte=doce_meses_atras
        ).order_by('-fecha_inicio')

        pagos_data = [{
            'id': p.id,
            'fecha_inicio': str(p.fecha_inicio) if p.fecha_inicio else None,
            'fecha_fin': str(p.fecha_fin) if p.fecha_fin else None,
            'monto_final': str(p.monto_final),
            'horas_calculadas': float(p.horas_calculadas),
            'total_alumnos_asistencias': p.total_alumnos_asistencias,
            'estado': p.estado,
            'ganancia_taller': str(p.ganancia_taller),
        } for p in pagos]

        return Response({
            'profesor': {
                'id': profesor.id,
                'nombre': profesor.nombre,
                'apellido': profesor.apellido,
                'nombre_completo': f"{profesor.apellido}, {profesor.nombre}",
                'dni': profesor.dni,
                'telefono': profesor.telefono,
                'email': profesor.email,
                'fecha_nacimiento': str(profesor.fecha_nacimiento) if profesor.fecha_nacimiento else None,
                'edad': profesor.edad,
                'activo': profesor.activo,
                'es_gerente': profesor.es_gerente,
                'observaciones': profesor.observaciones,
                'horarios': horarios_data,
                'pagos': pagos_data,
            },
        })
