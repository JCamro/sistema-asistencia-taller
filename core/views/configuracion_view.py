from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import Configuracion
from ..serializers import ConfiguracionSerializer


class ConfiguracionView(APIView):
    """Vista para obtener y actualizar la configuración de pago por ciclo."""
    permission_classes = [IsAuthenticated]

    def _get_instance(self):
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            return Configuracion.get_for_ciclo(ciclo_id)
        return Configuracion.get_active_config()

    def _update_ciclo_activo(self, data):
        """El ciclo activo sigue viviendo en el singleton (legacy)."""
        if 'ciclo_activo' in data:
            singleton = Configuracion.get_instance()
            singleton.ciclo_activo_id = data['ciclo_activo']
            singleton.save(update_fields=['ciclo_activo'])

    def get(self, request, **kwargs):
        """GET /api/config/ o /api/ciclos/<ciclo_id>/config/ - Retorna la configuración."""
        instance = self._get_instance()
        serializer = ConfiguracionSerializer(instance)
        return Response(serializer.data)

    def patch(self, request, **kwargs):
        """PATCH /api/config/ o /api/ciclos/<ciclo_id>/config/ - Actualiza la configuración."""
        self._update_ciclo_activo(request.data)
        instance = self._get_instance()
        serializer = ConfiguracionSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request, **kwargs):
        """PUT /api/config/ o /api/ciclos/<ciclo_id>/config/ - Actualiza toda la configuración."""
        self._update_ciclo_activo(request.data)
        instance = self._get_instance()
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
