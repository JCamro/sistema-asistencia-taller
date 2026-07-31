from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Horario, Alumno
from core.models.hora_trabajada import HoraTrabajada
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorDashboardView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/dashboard/

    Returns KPIs for the authenticated professor:
    - clases_hoy: number of classes today
    - total_alumnos: unique active students across all horarios
    - horas_dia: total hours worked today
    - horas_mes: total hours worked this month
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)
        today = timezone.now().date()
        first_of_month = today.replace(day=1)

        # Clases hoy: active horarios for today's day of week
        dia_semana_hoy = today.weekday()
        clases_hoy = Horario.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            dia_semana=dia_semana_hoy,
            activo=True
        ).count()

        # Total alumnos: unique active students across all this profesor's horarios
        total_alumnos = Alumno.objects.filter(
            matriculas__horarios__horario__profesor_id=profesor_id,
            matriculas__horarios__horario__ciclo_id=ciclo_id,
            matriculas__activo=True,
            matriculas__concluida=False,
        ).distinct().count()

        # Horas base query (reused for dia and mes)
        horas_base = HoraTrabajada.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
            estado__in=['pendiente', 'aprobada'],
        )

        # Horas del dia
        horas_dia = horas_base.filter(fecha=today).aggregate(
            total=Sum('horas_trabajadas')
        )['total'] or Decimal('0')

        # Horas del mes
        horas_mes = horas_base.filter(
            fecha__gte=first_of_month,
            fecha__lte=today,
        ).aggregate(total=Sum('horas_trabajadas'))['total'] or Decimal('0')

        return Response({
            'clases_hoy': clases_hoy,
            'total_alumnos': total_alumnos,
            'horas_dia': float(horas_dia),
            'horas_mes': float(horas_mes),
        })
