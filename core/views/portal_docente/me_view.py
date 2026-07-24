from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Profesor
from core.serializers.portal_docente.serializers import ProfesorSerializer
from core.shared.authentication import ProfesorJWTAuthentication


class ProfesorMeView(APIView):
    """
    GET /api/portal-docente/me/

    Returns the authenticated professor's profile.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profesor_id = request.user.id
        profesor = Profesor.objects.get(id=profesor_id)
        return Response(ProfesorSerializer({
            'id': profesor.id,
            'nombre': profesor.nombre,
            'apellido': profesor.apellido,
            'dni': profesor.dni,
            'email': profesor.email,
            'telefono': profesor.telefono,
        }).data)
