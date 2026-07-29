from rest_framework import serializers

from ..models import Nota


class NotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nota
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):
        es_recordatorio = data.get('es_recordatorio', getattr(self.instance, 'es_recordatorio', False))
        fecha = data.get('fecha', getattr(self.instance, 'fecha', None))
        fecha_vencimiento = data.get('fecha_vencimiento', getattr(self.instance, 'fecha_vencimiento', None))
        if es_recordatorio and fecha_vencimiento and fecha and fecha_vencimiento < fecha:
            raise serializers.ValidationError({
                'fecha_vencimiento': 'La fecha de vencimiento no puede ser anterior a la fecha de la nota.'
            })
        return data
