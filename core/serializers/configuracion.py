from rest_framework import serializers
from ..models import Configuracion


class ConfiguracionSerializer(serializers.ModelSerializer):
    ciclo_activo = serializers.SerializerMethodField()
    ciclo_activo_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)

    class Meta:
        model = Configuracion
        fields = [
            'id', 'ciclo_activo', 'ciclo_activo_nombre',
            'ciclo', 'ciclo_nombre',
            'pago_dinamico_base', 'pago_dinamico_tope', 'porcentaje_adicional',
            'updated_at'
        ]
        read_only_fields = ['id', 'ciclo', 'ciclo_nombre', 'ciclo_activo', 'ciclo_activo_nombre', 'updated_at']

    def get_ciclo_activo(self, obj):
        return Configuracion.get_instance().ciclo_activo_id

    def get_ciclo_activo_nombre(self, obj):
        activo = Configuracion.get_instance().ciclo_activo
        return activo.nombre if activo else None
