import re
from rest_framework import serializers

from core.models import Alumno
from .portal_serializers import PortalAlumnoSerializer, PortalCicloSerializer


class PortalLoginSerializer(serializers.Serializer):
    """Serializer for portal login request (DNI only)."""
    dni = serializers.CharField(
        min_length=7,
        max_length=15,
        required=True,
        error_messages={
            'required': 'El DNI es requerido.',
            'blank': 'El DNI no puede estar vacío.',
            'min_length': 'El DNI debe tener al menos 7 caracteres.',
            'max_length': 'El DNI no puede superar los 15 caracteres.',
        }
    )

    def validate_dni(self, value):
        """Validate DNI: alphanumeric only, 7-15 chars, no special characters."""
        value = value.strip()
        
        # Alphanumeric only (letters and numbers, no accents, no special chars)
        if not re.match(r'^[A-Za-z0-9]+$', value):
            raise serializers.ValidationError(
                'El DNI solo puede contener letras y números, sin caracteres especiales.'
            )
        
        return value.upper()


class TokenResponseSerializer(serializers.Serializer):
    """Serializer for token response after login."""
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = PortalAlumnoSerializer()
    ciclos = PortalCicloSerializer(many=True)
