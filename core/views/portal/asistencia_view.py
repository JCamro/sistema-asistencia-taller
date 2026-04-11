from collections import defaultdict

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Asistencia, Matricula
from core.serializers.portal.portal_serializers import PortalAsistenciaSerializer
from core.authentication import PortalJWTAuthentication


class PortalAsistenciasView(APIView):
    """
    GET /api/portal/me/asistencias/

    Returns paginated attendance records for the authenticated student.

    Query params:
    - ciclo_id: filter by cycle (required)
    - limit: max records to return (default 20, max 100)
    """
    authentication_classes = [PortalJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        alumno_id = request.user.id
        ciclo_id = request.query_params.get('ciclo_id')
        limit = request.query_params.get('limit', 20)
        
        if not ciclo_id:
            return Response(
                {"detail": "ciclo_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate limit
        try:
            limit = min(int(limit), 100)
        except (ValueError, TypeError):
            limit = 20
        
        # Get attendance records for this student in the specified cycle
        queryset = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id
        ).select_related(
            'horario__taller',
            'horario__profesor'
        ).order_by('-fecha', '-hora')[:limit]
        
        return Response(
            PortalAsistenciaSerializer(queryset, many=True).data
        )


class PortalAsistenciasDetalleView(APIView):
    """
    GET /api/portal/me/asistencias/detalle/

    Returns attendance grouped by taller/horario with full detail.
    Only includes talleres with active enrollment in the cycle.

    Query params:
    - ciclo_id: filter by cycle (required)
    """
    authentication_classes = [PortalJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        alumno_id = request.user.id
        ciclo_id = request.query_params.get('ciclo_id')
        
        if not ciclo_id:
            return Response(
                {"detail": "ciclo_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get active enrollments for this student in the cycle
        # (to filter only talleres with active enrollment)
        matriculas_activas = Matricula.objects.filter(
            alumno_id=alumno_id,
            ciclo_id=ciclo_id,
            activo=True,
            concluida=False
        ).select_related('taller').values_list('taller_id', 'horario__id')
        
        taller_ids_con_matricula = set(matriculas_activas.values_list('taller_id', flat=True))
        
        # Get attendance records for this student in the specified cycle
        queryset = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id,
            matricula__activo=True
        ).select_related(
            'horario__taller',
            'horario__profesor'
        ).order_by('horario__taller__nombre', 'horario__dia_semana', 'horario__hora_inicio', '-fecha')
        
        # Group by taller_id and horario_id
        por_taller = defaultdict(lambda: {
            'taller_id': None,
            'taller_nombre': None,
            'tipo': None,
            'horario': {},
            'profesor_nombre': None,
            'sesiones_contratadas': 0,
            'sesiones_disponibles': 0,
            'sesiones_consumidas': 0,
            'atenciones': []
        })
        
        for asistencia in queryset:
            taller = asistencia.horario.taller
            
            # Skip if taller not in active enrollments
            if taller.id not in taller_ids_con_matricula:
                continue
            
            horario = asistencia.horario
            # Use taller_id-horario_id as key to group by horario within taller
            key = (taller.id, horario.id)
            
            entry = por_taller[key]
            entry['taller_id'] = taller.id
            entry['taller_nombre'] = taller.nombre
            entry['tipo'] = taller.tipo
            
            if not entry['horario']:
                entry['horario'] = {
                    'dia_semana': horario.dia_semana,
                    'hora_inicio': horario.hora_inicio.strftime('%H:%M'),
                    'hora_fin': horario.hora_fin.strftime('%H:%M')
                }
                entry['profesor_nombre'] = f"{horario.profesor.apellido}, {horario.profesor.nombre}"
                
                # Get matricula for this horario to get sessions info
                try:
                    matricula = Matricula.objects.get(
                        alumno_id=alumno_id,
                        ciclo_id=ciclo_id,
                        taller_id=taller.id,
                        activo=True,
                        concluida=False
                    )
                    entry['sesiones_contratadas'] = matricula.sesiones_contratadas
                    entry['sesiones_disponibles'] = matricula.sesiones_disponibles
                    entry['sesiones_consumidas'] = matricula.sesiones_consumidas
                except Matricula.DoesNotExist:
                    pass
            
            entry['atenciones'].append({
                'fecha': asistencia.fecha.strftime('%Y-%m-%d'),
                'hora': asistencia.hora.strftime('%H:%M'),
                'estado': asistencia.estado
            })
        
        # Convert to list and sort
        resultado = sorted(
            [entry for entry in por_taller.values() if entry['taller_id'] is not None],
            key=lambda x: (x['taller_nombre'], x['horario'].get('dia_semana', ''), x['horario'].get('hora_inicio', ''))
        )
        
        return Response({'por_taller': resultado})
