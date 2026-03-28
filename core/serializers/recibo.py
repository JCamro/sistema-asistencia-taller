from rest_framework import serializers
from ..models import Recibo, ReciboMatricula
from django.utils import timezone


class ReciboMatriculaSerializer(serializers.ModelSerializer):
    taller_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ReciboMatricula
        fields = ['id', 'matricula', 'taller_nombre', 'monto']

    def get_taller_nombre(self, obj):
        return obj.matricula.taller.nombre


class ReciboSerializer(serializers.ModelSerializer):
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    matriculas_detalle = ReciboMatriculaSerializer(source='matriculas', many=True, read_only=True)

    class Meta:
        model = Recibo
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'saldo_pendiente']

    def create(self, validated_data):
        numero = self.generar_numero_recibo()
        validated_data['numero'] = numero
        return super().create(validated_data)

    def generar_numero_recibo(self):
        from datetime import datetime
        ultimo = Recibo.objects.order_by('-id').first()
        if ultimo:
            try:
                ultimo_num = int(ultimo.numero.split('-')[1])
                nuevo_num = ultimo_num + 1
            except:
                nuevo_num = 1
        else:
            nuevo_num = 1
        año = datetime.now().year
        return f"REC-{año}-{nuevo_num:04d}"


class ReciboListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Recibo
        fields = [
            'id', 'numero', 'alumno', 'alumno_nombre', 'ciclo', 'ciclo_nombre',
            'fecha_emision', 'monto_total', 'monto_pagado', 'saldo_pendiente', 'estado'
        ]

    def get_alumno_nombre(self, obj):
        return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
