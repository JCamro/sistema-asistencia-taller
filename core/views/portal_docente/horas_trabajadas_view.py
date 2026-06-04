from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models.hora_trabajada import HoraTrabajada
from core.serializers.portal_docente.serializers import HoraTrabajadaSerializer
from core.authentication import ProfesorJWTAuthentication


class ProfesorHorasTrabajadasView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horas-trabajadas/

    Returns HoraTrabajada records for the authenticated professor,
    filterable by date range and estado.

    Query params:
    - fecha_desde: YYYY-MM-DD (optional)
    - fecha_hasta: YYYY-MM-DD (optional)
    - estado: pendiente/aprobada/rechazada (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = request.user.id

        queryset = HoraTrabajada.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
        ).select_related(
            'horario__taller',
        ).order_by('-fecha')

        # Filter by date range
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if fecha_desde:
            queryset = queryset.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha__lte=fecha_hasta)

        # Filter by estado
        estado = request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)

        return Response(
            HoraTrabajadaSerializer(queryset, many=True).data
        )
