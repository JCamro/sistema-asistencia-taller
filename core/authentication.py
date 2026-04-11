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
