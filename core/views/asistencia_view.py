from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Asistencia, Matricula, MatriculaHorario, Horario
from ..serializers import AsistenciaSerializer, AsistenciaListSerializer
from .pagination import StandardResultsSetPagination


class AsistenciaViewSet(viewsets.ModelViewSet):
    queryset = Asistencia.objects.select_related(
        'matricula__alumno',
        'matricula__taller',
        'horario__taller',
        'profesor'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['matricula', 'horario', 'profesor', 'estado', 'fecha']
    search_fields = ['matricula__alumno__nombre', 'matricula__alumno__apellido']
    ordering_fields = ['fecha', 'hora']
    ordering = ['-fecha', '-hora']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return AsistenciaListSerializer
        return AsistenciaSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(
                Q(matricula__ciclo_id=ciclo_id) | 
                Q(horario__ciclo_id=ciclo_id)
            )
        return queryset

    @action(detail=False, methods=['get'], url_path='por-horario')
    def por_horario(self, request, ciclo_id=None):
        horario_id = request.query_params.get('horario_id')
        fecha = request.query_params.get('fecha')
        
        if not ciclo_id or not horario_id or not fecha:
            return Response({'error': 'Faltan parámetros: ciclo_id, horario_id, fecha'}, status=400)
        
        try:
            horario = Horario.objects.get(id=horario_id)
        except Horario.DoesNotExist:
            return Response({'error': 'Horario no encontrado'}, status=404)
        
        if str(horario.ciclo_id) != str(ciclo_id):
            return Response({'error': 'El horario no pertenece a este ciclo'}, status=400)
        
        matriculas_horario = MatriculaHorario.objects.filter(
            horario_id=horario_id
        ).select_related('matricula__alumno', 'matricula__taller')
        
        resultados = []
        alumnos_regulares_ids = set()
        
        for mh in matriculas_horario:
            if not mh.matricula.activo or mh.matricula.concluida:
                continue
            asistencia = Asistencia.objects.filter(
                matricula=mh.matricula,
                horario_id=horario_id,
                fecha=fecha
            ).first()
            
            alumnos_regulares_ids.add(mh.matricula.alumno.id)
            
            resultados.append({
                'matricula_id': mh.matricula.id,
                'alumno_id': mh.matricula.alumno.id,
                'alumno_nombre': f"{mh.matricula.alumno.apellido}, {mh.matricula.alumno.nombre}",
                'sesiones_disponibles': mh.matricula.sesiones_disponibles,
                'asistencia_id': asistencia.id if asistencia else None,
                'estado': asistencia.estado if asistencia else None,
                'observacion': asistencia.observacion if asistencia else '',
                'es_recuperacion': False,
                'hora': asistencia.hora.strftime('%H:%M') if asistencia else None,
            })
        
        # Incluir attendances de recuperación que no estén en matrículas regulares
        for asist in Asistencia.objects.filter(
            horario_id=horario_id,
            fecha=fecha,
            es_recuperacion=True
        ).select_related('matricula__alumno'):
            if asist.matricula and asist.matricula.alumno.id not in alumnos_regulares_ids:
                resultados.append({
                    'matricula_id': asist.matricula.id,
                    'alumno_id': asist.matricula.alumno.id,
                    'alumno_nombre': f"{asist.matricula.alumno.apellido}, {asist.matricula.alumno.nombre}",
                    'sesiones_disponibles': asist.matricula.sesiones_disponibles,
                    'asistencia_id': asist.id,
                    'estado': asist.estado,
                    'observacion': asist.observacion,
                    'es_recuperacion': True,
                    'hora': asist.hora.strftime('%H:%M'),
                })
        
        return Response(resultados)

    def create(self, request, *args, **kwargs):
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            data = request.data.copy()
            if 'profesor' not in data:
                return Response({'error': 'Profesor es requerido'}, status=400)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        return super().create(request, *args, **kwargs)
