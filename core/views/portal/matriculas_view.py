from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Matricula, MatriculaHorario
from core.serializers.portal.portal_serializers import PortalMatriculaSerializer, PortalMatriculaHistorialSerializer
from core.authentication import PortalJWTAuthentication


class PortalMatriculasView(APIView):
    """
    GET /api/portal/me/matriculas/

    Returns student's enrollments for a specific cycle, grouped into
    activas (active) and concluidas (concluded).

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
        
        # Get active enrollments
        activas = Matricula.objects.filter(
            alumno_id=alumno_id,
            ciclo_id=ciclo_id,
            activo=True,
            concluida=False
        ).select_related('taller')
        
        # Get concluded enrollments
        concluidas = Matricula.objects.filter(
            alumno_id=alumno_id,
            ciclo_id=ciclo_id,
            activo=True,
            concluida=True
        ).select_related('taller')
        
        return Response({
            'activas': PortalMatriculaSerializer(activas, many=True).data,
            'concluidas': PortalMatriculaSerializer(concluidas, many=True).data,
        })


class PortalMatriculasHistorialView(APIView):
    """
    GET /api/portal/me/matriculas/historial/

    Returns ALL concluded enrollments across ALL cycles for the authenticated student.
    Includes attendance percentage per enrollment.

    No query params required.
    """
    authentication_classes = [PortalJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        alumno_id = request.user.id
        
        # Get all concluded enrollments across all cycles
        matriculas = Matricula.objects.filter(
            alumno_id=alumno_id,
            activo=True,
            concluida=True
        ).select_related('taller', 'ciclo').order_by('-fecha_matricula')
        
        return Response(
            PortalMatriculaHistorialSerializer(matriculas, many=True).data
        )
