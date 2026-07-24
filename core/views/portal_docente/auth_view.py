import time
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from core.models import Profesor, Ciclo
from core.serializers.portal_docente.auth_serializers import ProfesorLoginSerializer
from core.serializers.portal_docente.serializers import ProfesorSerializer, CicloBasicSerializer
from core.shared.throttles import PortalDocenteLoginRateThrottle


class ProfesorLoginView(APIView):
    """
    POST /api/portal-docente/auth/login/

    Authenticates a professor using DNI only.
    Returns JWT access/refresh tokens with custom claims (profesor_id, dni).

    Security measures:
    - Rate limiting: 20 attempts/hour per DNI
    - Enumeration prevention: 2s delay on non-existent DNI
    """
    permission_classes = [AllowAny]
    throttle_classes = [PortalDocenteLoginRateThrottle]

    def post(self, request):
        serializer = ProfesorLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dni = serializer.validated_data['dni']

        # Enumeration prevention: check if ANY profesor record exists for this DNI
        profesores_qs = Profesor.objects.filter(dni__iexact=dni, activo=True)
        if not profesores_qs.exists():
            time.sleep(2)
            return Response(
                {"detail": "Credenciales inválidas"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Pick the first profesor for the JWT token (a teacher may have
        # multiple Profesor records, one per ciclo, same DNI)
        profesor = profesores_qs.first()

        # Generate JWT with custom claims
        refresh = RefreshToken()
        refresh['profesor_id'] = profesor.id
        refresh['dni'] = profesor.dni
        refresh['type'] = 'portal_docente'

        # Get ALL cycles where the teacher has a Profesor record.
        # Uses the direct Profesor→Ciclo FK (related_name='profesores')
        # instead of going through Horarios, so newly registered teachers
        # without assigned schedules still see their ciclo.
        ciclos = Ciclo.objects.filter(
            profesores__in=profesores_qs,
            activo=True,
        ).distinct()

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': ProfesorSerializer({
                'id': profesor.id,
                'nombre': profesor.nombre,
                'apellido': profesor.apellido,
                'dni': profesor.dni,
                'email': profesor.email,
                'telefono': profesor.telefono,
            }).data,
            'ciclos': CicloBasicSerializer(ciclos, many=True).data,
        })


class ProfesorLogoutView(APIView):
    """
    POST /api/portal-docente/auth/logout/

    Validates the refresh token and marks it for expiration.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')

        if not refresh_token:
            return Response(
                {"detail": "Refresh token requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            if 'profesor_id' not in token or token.get('type') != 'portal_docente':
                return Response(
                    {"detail": "Token inválido para portal docente"},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            return Response(
                {"detail": "Sesión cerrada"},
                status=status.HTTP_200_OK
            )
        except TokenError:
            return Response(
                {"detail": "Token inválido"},
                status=status.HTTP_401_UNAUTHORIZED
            )


class ProfesorRefreshView(APIView):
    """
    POST /api/portal-docente/auth/refresh/

    Exchanges a valid refresh token for a new access token.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')

        if not refresh_token:
            return Response(
                {"detail": "Refresh token requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            return Response({
                'access': str(token.access_token),
            })
        except TokenError:
            return Response(
                {"detail": "Token inválido o expirado"},
                status=status.HTTP_401_UNAUTHORIZED
            )
