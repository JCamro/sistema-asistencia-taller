from rest_framework import serializers
from decimal import Decimal
from ..models import Egreso, Profesor
from ..serializer_helpers import get_profesor_nombre


class EgresoSerializer(serializers.ModelSerializer):
    profesor_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    metodo_pago_display = serializers.CharField(source='get_metodo_pago_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Egreso
        fields = [
            'id', 'tipo', 'tipo_display', 'monto', 'descripcion', 'fecha',
            'metodo_pago', 'metodo_pago_display', 'categoria', 'beneficiario',
            'profesor', 'profesor_nombre', 'ciclo', 'ciclo_nombre',
            'estado', 'estado_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_monto(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('El monto debe ser mayor a 0.')
        return value

    def validate(self, data):
        if data.get('tipo') == 'pago_profesor' and not data.get('profesor'):
            raise serializers.ValidationError({
                'profesor': 'El profesor es obligatorio para pagos a profesor.'
            })
        return data

    def get_profesor_nombre(self, obj):
        return get_profesor_nombre(obj)


class EgresoListSerializer(serializers.ModelSerializer):
    profesor_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model = Egreso
        fields = [
            'id', 'tipo', 'tipo_display', 'monto', 'descripcion', 'fecha',
            'categoria', 'beneficiario', 'profesor', 'profesor_nombre',
            'ciclo', 'ciclo_nombre', 'estado', 'estado_display'
        ]

    def get_profesor_nombre(self, obj):
        return get_profesor_nombre(obj)
