from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Alumno, Matricula
from ..serializers import AlumnoSerializer, AlumnoListSerializer
from ..shared.serializer_helpers import get_estado_matricula, get_recibo_estado
from .pagination import StandardResultsSetPagination


class AlumnoViewSet(viewsets.ModelViewSet):
    queryset = Alumno.objects.select_related('ciclo').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activo']
    search_fields = ['nombre', 'apellido', 'dni', 'email']
    ordering_fields = ['apellido', 'nombre', 'created_at']
    ordering = ['-created_at']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return AlumnoListSerializer
        return AlumnoSerializer

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

        alumno = self.get_object()
        matriculas = Matricula.objects.filter(
            alumno=alumno,
            ciclo_id=ciclo_id
        ).select_related('taller').prefetch_related('horarios', 'asistencias')

        matriculas_data = []
        for m in matriculas:
            asistencias = m.asistencias.all()
            asistencias_data = [{
                'id': a.id,
                'fecha': str(a.fecha),
                'estado': a.estado,
                'es_recuperacion': a.es_recuperacion,
            } for a in asistencias]

            matriculas_data.append({
                'id': m.id,
                'taller': m.taller.nombre,
                'taller_id': m.taller.id,
                'sesiones_contratadas': m.sesiones_contratadas,
                'sesiones_consumidas': m.sesiones_consumidas,
                'sesiones_disponibles': m.sesiones_disponibles,
                'precio_total': str(m.precio_total),
                'estado': get_estado_matricula(m),
                'recibo_estado': get_recibo_estado(m),
                'fecha_matricula': m.fecha_matricula.isoformat() if m.fecha_matricula else None,
                'asistencias': asistencias_data,
            })

        return Response({
            'alumno': {
                'id': alumno.id,
                'nombre': alumno.nombre,
                'apellido': alumno.apellido,
                'nombre_completo': f"{alumno.apellido}, {alumno.nombre}",
                'dni': alumno.dni,
                'telefono': alumno.telefono,
                'email': alumno.email,
                'edad': alumno.edad,
                'activo': alumno.activo,
                'created_at': alumno.created_at.isoformat() if alumno.created_at else None,
            },
            'matriculas': matriculas_data,
        })
