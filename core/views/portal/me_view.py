from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Alumno
from core.serializers.portal.portal_serializers import PortalAlumnoSerializer
from core.authentication import PortalJWTAuthentication


class PortalMeView(APIView):
    """
    GET /api/portal/me/

    Returns the authenticated student's public profile.
    Only exposes id, nombre, apellido (NOT dni, email, telefono, fecha_nacimiento).
    """
    authentication_classes = [PortalJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # request.user is a DummyUser with the alumno_id from the JWT token
        alumno_id = request.user.id
        alumno = Alumno.objects.get(id=alumno_id)
        return Response(PortalAlumnoSerializer(alumno).data)
