from django.http import JsonResponse
from django.views import View
from django.contrib.auth import get_user_model

User = get_user_model()

class SetupView(View):
    """
    Endpoint temporal para crear el primer superuser.
    Solo funciona si NO existe ningún superuser en el sistema.
    Se debe eliminar después de usar.
    """
    def get(self, request):
        # Verificar si ya hay superusers
        if User.objects.filter(is_superuser=True).exists():
            return JsonResponse({
                'error': 'Ya existen superusers. No se puede usar este endpoint.'
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
            'message': 'Superuser creado exitosamente',
            'username': 'admin',
            'password': 'admin123'
        })