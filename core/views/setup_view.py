"""
Vista de configuración inicial para deploy.
Permite crear el primer superusuario y usuario de la app cuando no existen usuarios.
"""
from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib import messages
from django.utils import timezone
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

User = get_user_model()


@method_decorator(csrf_exempt, name='dispatch')
class SetupView(View):
    """
    Vista para configuración inicial del sistema.
    Solo accesible cuando NO existen superusuarios.
    """
    
    template_name = 'setup.html'
    
    def get(self, request):
        """Mostrar formulario si no hay superusuarios, otherwise 403."""
        # Verificar si ya existe al menos un superusuario
        if User.objects.filter(is_superuser=True).exists():
            return render(request, 'setup_blocked.html', {
                'message': 'El sistema ya ha sido configurado. Accede al admin para gestionar usuarios.'
            }, status=403)
        
        return render(request, self.template_name)
    
    def post(self, request):
        """Procesar la creación de superusuario y usuario de la app."""
        # Verificar nuevamente que no hay superusuarios (seguridad)
        if User.objects.filter(is_superuser=True).exists():
            return render(request, 'setup_blocked.html', {
                'message': 'El sistema ya ha sido configurado.'
            }, status=403)
        
        # Obtener datos del formulario
        super_username = request.POST.get('super_username', '').strip()
        super_password = request.POST.get('super_password', '')
        super_password_confirm = request.POST.get('super_password_confirm', '')
        
        app_username = request.POST.get('app_username', '').strip()
        app_password = request.POST.get('app_password', '')
        app_password_confirm = request.POST.get('app_password_confirm', '')
        
        app_nombre = request.POST.get('app_nombre', '').strip()
        app_apellido = request.POST.get('app_apellido', '').strip()
        
        errors = []
        
        # Validaciones Superusuario
        if not super_username:
            errors.append('El nombre de usuario del administrador es requerido.')
        elif len(super_username) < 3:
            errors.append('El nombre de usuario debe tener al menos 3 caracteres.')
        elif User.objects.filter(username=super_username).exists():
            errors.append('El nombre de usuario del administrador ya existe.')
        
        if not super_password:
            errors.append('La contraseña del administrador es requerida.')
        elif len(super_password) < 8:
            errors.append('La contraseña del administrador debe tener al menos 8 caracteres.')
        
        if super_password != super_password_confirm:
            errors.append('Las contraseñas del administrador no coinciden.')
        
        # Validaciones Usuario App
        if not app_username:
            errors.append('El nombre de usuario de la app es requerido.')
        elif len(app_username) < 3:
            errors.append('El nombre de usuario debe tener al menos 3 caracteres.')
        elif User.objects.filter(username=app_username).exists():
            errors.append('El nombre de usuario de la app ya existe.')
        
        if not app_password:
            errors.append('La contraseña de la app es requerida.')
        elif len(app_password) < 8:
            errors.append('La contraseña de la app debe tener al menos 8 caracteres.')
        
        if app_password != app_password_confirm:
            errors.append('Las contraseñas de la app no coinciden.')
        
        if not app_nombre:
            errors.append('El nombre del usuario es requerido.')
        
        if not app_apellido:
            errors.append('El apellido del usuario es requerido.')
        
        if errors:
            return render(request, self.template_name, {
                'errors': errors,
                'super_username': super_username,
                'app_username': app_username,
                'app_nombre': app_nombre,
                'app_apellido': app_apellido,
            })
        
        # Crear usuarios dentro de transacción
        try:
            with transaction.atomic():
                # Crear superusuario (admin del sistema)
                superuser = User.objects.create_user(
                    username=super_username,
                    email='admin@taller.com',
                    password=super_password,
                    is_staff=True,
                    is_superuser=True,
                    first_name='Admin',
                    last_name='Sistema'
                )
                
                # Crear usuario para la app (usuario normal)
                app_user = User.objects.create_user(
                    username=app_username,
                    email=f'{app_username}@taller.com',
                    password=app_password,
                    is_staff=False,
                    is_superuser=False,
                    first_name=app_nombre,
                    last_name=app_apellido
                )
            
            # Éxito - mostrar mensaje
            messages.success(request, f'''
                ¡Configuración completada exitosamente!
                
                Credenciales Administrador:
                - Usuario: {super_username}
                - Contraseña: (la que ingresaste)
                - URL Admin: /admin/
                
                Credenciales App:
                - Usuario: {app_username}
                - Contraseña: (la que ingresaste)
                - URL App: /login/
            ''')
            
            return render(request, 'setup_success.html', {
                'super_username': super_username,
                'app_username': app_username,
            })
            
        except Exception as e:
            return render(request, self.template_name, {
                'errors': [f'Error al crear usuarios: {str(e)}'],
                'super_username': super_username,
                'app_username': app_username,
                'app_nombre': app_nombre,
                'app_apellido': app_apellido,
            })


class SetupBlockedView(View):
    """Vista mostrada cuando el setup ya fue completado."""
    
    template_name = 'setup_blocked.html'
    
    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    
    def get(self, request):
        return render(request, self.template_name, {
            'message': 'El sistema ya ha sido configurado. Accede al admin para gestionar usuarios.'
        }, status=403)


class SetupSuccessView(View):
    """Vista mostrada después de completar el setup."""
    
    template_name = 'setup_success.html'
    
    def get(self, request):
        return render(request, self.template_name)