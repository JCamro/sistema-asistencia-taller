from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Ciclo, Matricula
from core.serializers.portal.portal_serializers import PortalCicloSerializer
from core.authentication import PortalJWTAuthentication


class PortalCiclosView(APIView):
    """
    GET /api/portal/me/ciclos/

    Returns all cycles where the authenticated student has at least one enrollment.
    Each cycle includes has_matricula_activa flag.
    """
    authentication_classes = [PortalJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        alumno_id = request.user.id

        # Get cycles where student has any enrollment (active or concluded)
        ciclos = Ciclo.objects.filter(
            matriculas__alumno_id=alumno_id
        ).distinct().order_by('-fecha_inicio')

        return Response(
            PortalCicloSerializer(
                ciclos, many=True, context={'alumno': alumno_id}
            ).data
        )
