from django.http import Http404
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class DummyUser:
    """
    Dummy user representing a portal student (not a Django User).
    Used to satisfy DRF's authentication system for portal endpoints.
    """
    def __init__(self, alumno_id, dni=None):
        self.id = alumno_id
        self.dni = dni
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False
        self._alumno_ids = None

    @property
    def alumno_ids(self):
        """
        Returns all Alumno IDs with the same DNI.
        A student can have multiple Alumno records (one per cycle),
        so we need all of them to query across cycles.
        """
        if self._alumno_ids is None and self.dni:
            from core.models import Alumno
            self._alumno_ids = list(
                Alumno.objects.filter(dni__iexact=self.dni).values_list('id', flat=True)
            )
        return self._alumno_ids or [self.id]

    def __str__(self):
        return f"PortalAlumno(id={self.id})"


class PortalJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication for portal students.
    Since students aren't Django users, we extract their identity
    from the JWT token claims (alumno_id, dni) and create a DummyUser.
    """
    def get_user(self, validated_token):
        """
        Returns a DummyUser with the alumno_id from the token claims.
        The token contains custom claims set during portal login:
        - alumno_id: the student's primary key
        - dni: the student's DNI number
        
        Returns None if the token doesn't contain portal-specific claims,
        allowing DRF to try the next authenticator (for admin tokens).
        """
        try:
            alumno_id = validated_token.get('alumno_id')
            if not alumno_id:
                # Token doesn't have portal claims - return None to let
                # DRF try the next authenticator (admin JWTAuthentication)
                return None
            
            dni = validated_token.get('dni')
            return DummyUser(alumno_id, dni)
        except KeyError:
            raise InvalidToken('Token contained no recognizable user identification')


class ProfesorDummyUser:
    """
    Dummy user representing a portal docente (not a Django User).
    Used to satisfy DRF's authentication system for portal-docente endpoints.
    """
    def __init__(self, profesor_id, dni=None):
        self.id = profesor_id
        self.dni = dni
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False
        self._profesor_ids = None

    def __str__(self):
        return f"PortalDocente(id={self.id})"


class ProfesorJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication for portal docente (teachers).
    Extracts profesor identity from JWT token claims (profesor_id, dni).
    
    Returns None if the token doesn't contain portal-docente claims,
    allowing DRF to try the next authenticator (for admin tokens).
    """
    def get_user(self, validated_token):
        try:
            profesor_id = validated_token.get('profesor_id')
            if not profesor_id:
                return None
            dni = validated_token.get('dni')
            return ProfesorDummyUser(profesor_id, dni)
        except KeyError:
            raise InvalidToken('Token contained no recognizable user identification')


def get_profesor_for_ciclo(dni, ciclo_id):
    """
    Resolves the correct Profesor ID for a given DNI and cycle.

    Since Profesor has unique_together = ['ciclo', 'dni'], a teacher
    gets a different profesor_id per cycle. This helper resolves the
    correct one at request time instead of trusting the JWT-locked ID.

    Returns:
        int — the resolved profesor_id

    Raises:
        Http404 — if no Profesor record exists for (dni, ciclo_id)
    """
    from core.models import Profesor

    try:
        profesor = Profesor.objects.get(dni=dni, ciclo_id=ciclo_id, activo=True)
        return profesor.id
    except Profesor.DoesNotExist:
        raise Http404('Profesor no encontrado para este ciclo')
