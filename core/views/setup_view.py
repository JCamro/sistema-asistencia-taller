from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class SetupView(APIView):
    """
    Endpoint temporal para crear el primer superuser.
    """
    authentication_classes = []  # Sin autenticación
    permission_classes = []  # Sin permisos
    
    def get(self, request):
        return Response({
            'status': 'ok',
            'superusers_count': User.objects.filter(is_superuser=True).count(),
            'message': 'Use POST to create superuser'
        })
    
    def post(self, request):
        # Verificar si ya hay superusers
        if User.objects.filter(is_superuser=True).exists():
            return Response({
                'error': 'Ya existen superusers'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Crear superuser por defecto
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
            'password': 'admin123'
        })