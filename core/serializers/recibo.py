from rest_framework import serializers
from ..models import Recibo, ReciboMatricula
from ..services import ReciboService
from ..shared.serializer_helpers import get_alumnos_nombres


class ReciboMatriculaSerializer(serializers.ModelSerializer):
    taller_nombre = serializers.SerializerMethodField()
    taller_tipo = serializers.SerializerMethodField()
    alumno_nombre = serializers.SerializerMethodField()
    sesiones_contratadas = serializers.SerializerMethodField()

    class Meta:
        model = ReciboMatricula
        fields = ['id', 'matricula', 'taller_nombre', 'taller_tipo', 'alumno_nombre', 'sesiones_contratadas', 'monto']

    def get_taller_nombre(self, obj):
        return obj.matricula.taller.nombre

    def get_taller_tipo(self, obj):
        return obj.matricula.taller.tipo

    def get_alumno_nombre(self, obj):
        a = obj.matricula.alumno
        return f"{a.nombre} {a.apellido}"

    def get_sesiones_contratadas(self, obj):
        return obj.matricula.sesiones_contratadas


class ReciboSerializer(serializers.ModelSerializer):
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    porcentaje_descuento = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)
    matriculas_detalle = ReciboMatriculaSerializer(source='matriculas', many=True, read_only=True)
    matricula_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    alumno_nombre = serializers.SerializerMethodField()
    alumnos_nombres = serializers.SerializerMethodField()

    class Meta:
        model = Recibo
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'saldo_pendiente', 'porcentaje_descuento', 'numero']

    def get_alumno_nombre(self, obj):
        if obj.alumno:
            return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
        primera = obj.matriculas.select_related('matricula__alumno').first()
        if primera:
            a = primera.matricula.alumno
            return f"{a.apellido}, {a.nombre}"
        return "Sin alumno"

    def get_alumnos_nombres(self, obj):
        return get_alumnos_nombres(obj)

    def create(self, validated_data):
        matricula_ids = validated_data.pop('matricula_ids', [])
        return ReciboService.create_recibo(validated_data, matricula_ids)

    def update(self, instance, validated_data):
        matricula_ids = validated_data.pop('matricula_ids', None)
        return ReciboService.update_recibo(instance, validated_data, matricula_ids)


class ReciboListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    alumnos_nombres = serializers.SerializerMethodField()
    matricula_ids = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    paquete_display = serializers.CharField(source='paquete_label', read_only=True)
    paquete_label = serializers.CharField(read_only=True)
    metodo_pago = serializers.CharField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Recibo
        fields = [
            'id', 'numero', 'alumno', 'alumno_nombre', 'alumnos_nombres',
            'matricula_ids', 'ciclo', 'ciclo_nombre', 'fecha_emision', 'monto_bruto', 'monto_total',
            'monto_pagado', 'descuento', 'paquete_aplicado', 'paquete_label', 'paquete_display',
            'precio_editado', 'saldo_pendiente', 'estado', 'metodo_pago', 'updated_at'
        ]

    def get_alumno_nombre(self, obj):
        if obj.alumno:
            return f"{obj.alumno.apellido}, {obj.alumno.nombre}"
        primera = obj.matriculas.select_related('matricula__alumno').first()
        if primera:
            a = primera.matricula.alumno
            return f"{a.apellido}, {a.nombre}"
        return "Sin alumno"

    def get_alumnos_nombres(self, obj):
        return get_alumnos_nombres(obj)

    def get_matricula_ids(self, obj):
        return [rm.matricula_id for rm in obj.matriculas.all()]



