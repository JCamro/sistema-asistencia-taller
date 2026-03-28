from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Configuracion
from ..serializers import ConfiguracionSerializer


class ConfiguracionViewSet(viewsets.ModelViewSet):
    queryset = Configuracion.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = ConfiguracionSerializer

    def get_object(self):
        return Configuracion.get_instance()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)
