"""
Vista para gestión de usuarios (cambio de contraseña).
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth import get_user_model

User = get_user_model()


class CambiarPasswordView(APIView):
    """
    Endpoint para cambiar la contraseña del usuario actual.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        new_password_confirm = request.data.get('new_password_confirm', '')
        
        # Validaciones
        errors = []
        
        if not old_password:
            errors.append('La contraseña actual es requerida')
        
        if not new_password:
            errors.append('La nueva contraseña es requerida')
        
        if not new_password_confirm:
            errors.append('Debe confirmar la nueva contraseña')
        
        if new_password != new_password_confirm:
            errors.append('Las contraseñas nuevas no coinciden')
        
        if new_password and len(new_password) < 8:
            errors.append('La contraseña debe tener al menos 8 caracteres')
        
        if errors:
            return Response({
                'detail': errors[0]
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar contraseña actual
        if not request.user.check_password(old_password):
            return Response({
                'detail': 'La contraseña actual es incorrecta'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Cambiar contraseña
        request.user.set_password(new_password)
        request.user.save()
        
        return Response({
            'message': 'Contraseña actualizada correctamente'
        })