from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.contrib.auth import get_user_model
import os

User = get_user_model()

@csrf_exempt
def setup_view(request):
    """
    Endpoint temporal para crear el primer superuser.
    """
    # Si ya existe un superuser, no hacer nada
    if User.objects.filter(is_superuser=True).exists():
        return JsonResponse({
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
    
    return JsonResponse({
        'message': 'Superuser creado',
        'username': 'admin',
        'password': 'admin123',
        'admin_url': '/admin/'
    })