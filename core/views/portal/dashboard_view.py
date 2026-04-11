from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Matricula, Asistencia, MatriculaHorario, Horario, Alumno, Ciclo
from core.serializers.portal.portal_serializers import (
    PortalHorarioSerializer,
    PortalAsistenciaSerializer,
    PortalMatriculaSerializer,
    PortalReciboSerializer,
)
from core.authentication import PortalJWTAuthentication


class PortalDashboardView(APIView):
    """
    GET /api/portal/me/dashboard/

    Returns dashboard data for the student's portal.
    Matches the DashboardData frontend type.

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

        # Get alumno info for greeting
        alumno = Alumno.objects.get(id=alumno_id)
        ciclo = Ciclo.objects.get(id=ciclo_id)

        # Active enrollments with taller info (for MatriculasActivasCard)
        matriculas_activas = Matricula.objects.filter(
            alumno_id=alumno_id,
            ciclo_id=ciclo_id,
            activo=True,
            concluida=False
        ).select_related('taller', 'ciclo')

        # Horarios for the week (for HorariosProximosCard)
        horario_ids = MatriculaHorario.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id,
            matricula__activo=True
        ).values_list('horario_id', flat=True).distinct()

        horarios_semana = Horario.objects.filter(
            id__in=horario_ids,
            ciclo_id=ciclo_id,
            activo=True
        ).select_related('taller', 'profesor').order_by('dia_semana', 'hora_inicio')

        # Last 5 attendances (for UltimasAsistenciasCard)
        ultimas_asistencias = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id
        ).select_related(
            'horario__taller',
            'horario__profesor'
        ).order_by('-fecha', '-hora')[:5]

        # Attendance stats for the cycle
        total_asistencias = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id
        ).count()

        asistidas = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id,
            estado='asistio'
        ).count()

        faltas = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id,
            estado='falta'
        ).count()

        faltas_graves = Asistencia.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id,
            estado='falta_grave'
        ).count()

        porcentaje = 0
        if total_asistencias > 0:
            porcentaje = round((asistidas / total_asistencias) * 100, 1)

        # Pending payments (full receipt objects for display)
        from core.models import Recibo, ReciboMatricula
        recibo_ids = ReciboMatricula.objects.filter(
            matricula__alumno_id=alumno_id,
            matricula__ciclo_id=ciclo_id
        ).values_list('recibo_id', flat=True).distinct()

        recibos_pendientes = Recibo.objects.filter(
            id__in=recibo_ids,
            ciclo_id=ciclo_id
        ).exclude(estado='anulado').order_by('-fecha_emision')

        # Filter to only those with pending balance
        pagos_pendientes = [
            r for r in recibos_pendientes if r.saldo_pendiente > 0
        ]

        return Response({
            # Greeting data (matches frontend GreetingCard)
            'alumno': {
                'id': alumno.id,
                'nombre': alumno.nombre,
                'apellido': alumno.apellido,
            },
            'ciclo_activo': ciclo.nombre,
            # Matrículas activas (for MatriculasActivasCard)
            'matriculas_activas': PortalMatriculaSerializer(matriculas_activas, many=True).data,
            # Horarios de la semana (for HorariosProximosCard)
            'horarios_proximos': PortalHorarioSerializer(horarios_semana, many=True).data,
            # Últimas 5 asistencias (for UltimasAsistenciasCard)
            'ultimas_asistencias': PortalAsistenciaSerializer(ultimas_asistencias, many=True).data,
            # Stats
            'asistencia_stats': {
                'total': total_asistencias,
                'asistidas': asistidas,
                'faltas': faltas,
                'faltas_graves': faltas_graves,
                'porcentaje': porcentaje,
            },
            # Pagos pendientes (full receipt objects for PagosPendientesAlert)
            'pagos_pendientes': PortalReciboSerializer(pagos_pendientes, many=True).data,
        })
