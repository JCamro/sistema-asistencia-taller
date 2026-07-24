from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Ciclo
from core.serializers.portal_docente.serializers import CicloBasicSerializer
from core.shared.authentication import ProfesorJWTAuthentication


class ProfesorCiclosView(APIView):
    """
    GET /api/portal-docente/ciclos/

    Returns active cycles where the authenticated professor has horarios.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profesor_id = request.user.id

        ciclos = Ciclo.objects.filter(
            horarios__profesor_id=profesor_id,
            activo=True,
        ).distinct().order_by('-fecha_inicio')

        return Response(
            CicloBasicSerializer(ciclos, many=True).data
        )
