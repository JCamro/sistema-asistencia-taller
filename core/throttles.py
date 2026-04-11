from rest_framework.throttling import UserRateThrottle


class PortalLoginRateThrottle(UserRateThrottle):
    """
    Rate limiting for portal login attempts.
    Limits to 20 login attempts per hour per DNI.
    The throttle scope is set dynamically in get_cache_key() based on the DNI.
    """
    scope = 'student_login'

    def get_cache_key(self, request, view):
        if request.method != 'POST':
            return None

        # Get DNI from request data - strip whitespace before throttling
        dni = request.data.get('dni', '').strip()
        if not dni:
            # If no DNI in request, throttle by IP
            return self.cache_format % {
                'scope': self.scope,
                'ident': self.get_ident(request)
            }

        # Throttle by DNI to prevent credential stuffing
        return self.cache_format % {
            'scope': self.scope,
            'ident': dni
        }
