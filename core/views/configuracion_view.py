from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import Configuracion
from ..serializers import ConfiguracionSerializer


class ConfiguracionView(APIView):
    """Vista para obtener y actualizar la configuración singleton."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/config/ - Retorna la configuración."""
        instance = Configuracion.get_instance()
        serializer = ConfiguracionSerializer(instance)
        return Response(serializer.data)

    def patch(self, request):
        """PATCH /api/config/ - Actualiza la configuración."""
        instance = Configuracion.get_instance()
        serializer = ConfiguracionSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        """PUT /api/config/ - Actualiza toda la configuración."""
        instance = Configuracion.get_instance()
        serializer = ConfiguracionSerializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# Alias para compatibilidad con el router si se usare
class ConfiguracionViewSet(viewsets.ViewSet):
    """ViewSet de compatibilidad (deprecated, usar ConfiguracionView)."""
    permission_classes = [IsAuthenticated]

    def retrieve(self, request):
        return self.get(request)

    def partial_update(self, request):
        return self.patch(request)
