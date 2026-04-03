from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt

User = get_user_model()

@csrf_exempt
def setup_view(request):
    """
    Endpoint temporal para crear el primer superuser.
    """
    if request.method != 'POST':
        return JsonResponse({
            'status': 'ok',
            'superusers_count': User.objects.filter(is_superuser=True).count(),
            'message': 'Use POST to create superuser'
        })
    
    # Verificar si ya hay superusers
    if User.objects.filter(is_superuser=True).exists():
        return JsonResponse({
            'error': 'Ya existen superusers'
        }, status=403)
    
    # Crear superuser por defecto
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
        'password': 'admin123'
    })