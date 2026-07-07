from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import PagoProfesor
from core.serializers.portal_docente.serializers import PagoProfesorPortalSerializer
from core.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorPagosView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/pagos/

    Returns PagoProfesor records for the authenticated professor,
    filterable by estado.

    Query params:
    - estado: calculado/pagado/anulado (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
        profesor_id = request.user.id
        estado = request.query_params.get('estado')

        qs = PagoProfesor.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
        ).prefetch_related('detalles').order_by('-fecha_inicio')

        if estado:
            qs = qs.filter(estado=estado)

        serializer = PagoProfesorPortalSerializer(qs, many=True)
        return Response(serializer.data)
