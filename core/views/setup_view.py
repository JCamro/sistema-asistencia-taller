from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

User = get_user_model()

@api_view(['GET'])
@authentication_classes([])
@permission_classes([])
def setup_view(request):
    """
    Endpoint temporal para crear el primer superuser.
    GET automático crea el superuser si no existe.
    """
    # Si ya existe un superuser, no hacer nada
    if User.objects.filter(is_superuser=True).exists():
        return Response({
            'message': 'El superuser ya existe',
            'username': 'admin',
            'admin_url': '/admin/'
        })
    
    # Crear superuser automáticamente
    user = User.objects.create_user(
        username='admin',
        email='admin@taller.com',
        password='admin123',
        is_staff=True,
        is_superuser=True
    )
    
    return Response({
        'message': 'Superuser creado',
        'username': 'admin',
        'password': 'admin123',
        'admin_url': '/admin/'
    })