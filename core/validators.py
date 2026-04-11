"""
Validators compartidos para serializers del core.
"""
from django.core.validators import RegexValidator

# Validator: 1-15 alphanumeric characters (DNI)
alphanumeric_validator = RegexValidator(
    regex=r'^[A-Za-z0-9]{1,15}$',
    message='El DNI debe contener entre 1 y 15 caracteres alfanuméricos.'
)
