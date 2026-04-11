from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Horario, MatriculaHorario, Matricula
from core.serializers.portal.portal_serializers import PortalHorarioSerializer
from core.authentication import PortalJWTAuthentication


class PortalHorariosView(APIView):
    """
    GET /api/portal/me/horarios/

    Returns student's weekly class schedule for a specific cycle.

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
        
        # Get all horario IDs from student's active enrollments in this cycle
        horario_ids = MatriculaHorario.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id,
            matricula__activo=True
        ).values_list('horario_id', flat=True).distinct()
        
        # Get the actual horarios
        horarios = Horario.objects.filter(
            id__in=horario_ids,
            ciclo_id=ciclo_id,
            activo=True
        ).select_related(
            'taller',
            'profesor'
        ).order_by('dia_semana', 'hora_inicio')
        
        return Response(
            PortalHorarioSerializer(horarios, many=True).data
        )
