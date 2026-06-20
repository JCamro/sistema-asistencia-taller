from datetime import datetime

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import Count
from django.db.models.functions import TruncDate

from core.models import Asistencia, Horario
from core.serializers.portal_docente.serializers import (
    AsistenciaPorHorarioSerializer,
    HorarioResumenSerializer,
)
from core.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorAsistenciasView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/asistencias/

    Returns read-only attendance records filtered by horario and date.
    Query params:
    - horario_id: required
    - fecha: YYYY-MM-DD (required)

    POST/PATCH/PUT/DELETE are rejected with 405 Method Not Allowed.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)
        horario_id = request.query_params.get('horario_id')
        fecha_str = request.query_params.get('fecha')

        # Validate required params
        if not horario_id or not fecha_str:
            return Response(
                {"detail": "horario_id y fecha son requeridos"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate date format
        try:
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response(
                {"detail": "Fecha inválida. Use formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify horario belongs to this profesor and ciclo
        horario_exists = Horario.objects.filter(
            id=horario_id,
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            activo=True
        ).exists()

        if not horario_exists:
            return Response(
                {"detail": "Horario no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get attendance records for this horario and date
        # Note: We DON'T filter by matricula__concluida because concluded matrículas
        # still have valid past attendance records that must be shown.
        # We only verify the matrícula existed on that date.
        asistencias = Asistencia.objects.filter(
            horario_id=horario_id,
            fecha=fecha,
            matricula__activo=True,
            matricula__fecha_matricula__date__lte=fecha,
        ).select_related(
            'matricula__alumno',
            'horario',
        ).order_by('matricula__alumno__apellido')

        return Response(
            AsistenciaPorHorarioSerializer(asistencias, many=True).data
        )

    def post(self, request, *args, **kwargs):
        return Response(
            {"detail": "Método no permitido. La asistencia es de solo lectura."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def put(self, request, *args, **kwargs):
        return Response(
            {"detail": "Método no permitido. La asistencia es de solo lectura."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def patch(self, request, *args, **kwargs):
        return Response(
            {"detail": "Método no permitido. La asistencia es de solo lectura."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    def delete(self, request, *args, **kwargs):
        return Response(
            {"detail": "Método no permitido. La asistencia es de solo lectura."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )


class ProfesorAsistenciasPorHorarioView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/asistencias/por-horario/

    Returns grouped horario summaries with attendance dates for the
    authenticated profesor in the given cycle.

    Response shape:
    {
        "horarios": [
            {
                "horario_id": int,
                "taller_nombre": str,
                "dia_semana": int,
                "hora_inicio": "HH:MM",
                "hora_fin": "HH:MM",
                "total_clases": int,
                "fechas": ["YYYY-MM-DD", ...]
            }
        ]
    }
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        # Get active horarios for this profesor in this cycle
        horarios = Horario.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            activo=True,
        ).select_related('taller').order_by('dia_semana', 'hora_inicio')

        # Build response with date lists per horario
        result = []
        for horario in horarios:
            fechas_qs = Asistencia.objects.filter(
                horario=horario,
                matricula__activo=True,
            ).dates('fecha', 'day')

            fechas = [f.strftime('%Y-%m-%d') for f in fechas_qs]

            total_clases = Asistencia.objects.filter(
                horario=horario,
                matricula__activo=True,
            ).values('fecha').distinct().count()

            # Attach annotations for the serializer
            horario.total_clases = total_clases
            horario.fechas = fechas

        return Response({
            'horarios': HorarioResumenSerializer(horarios, many=True).data,
        })
