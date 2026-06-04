from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Horario
from core.serializers.portal_docente.serializers import HorarioConAlumnosSerializer
from core.authentication import ProfesorJWTAuthentication


class ProfesorHorariosView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horarios/

    Returns professor's schedules with enrolled student counts for a cycle.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = request.user.id

        horarios = Horario.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            activo=True
        ).select_related(
            'taller',
            'profesor'
        ).order_by('dia_semana', 'hora_inicio')

        return Response(
            HorarioConAlumnosSerializer(horarios, many=True).data
        )


class ProfesorHorarioDetalleView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horarios/{horario_id}/

    Returns schedule details with enrolled students list.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id, horario_id):
        profesor_id = request.user.id

        try:
            horario = Horario.objects.filter(
                id=horario_id,
                ciclo_id=ciclo_id,
                profesor_id=profesor_id,
                activo=True
            ).select_related(
                'taller',
                'profesor'
            ).get()
        except Horario.DoesNotExist:
            return Response(
                {"detail": "Horario no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            HorarioConAlumnosSerializer(horario).data
        )
