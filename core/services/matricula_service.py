"""
Servicio para la lógica de negocio de Matrículas.

Maneja la creación y actualización de matrículas,
incluyendo la gestión de horarios asociados.
"""
from decimal import Decimal

from django.db import transaction

from ..models import Horario, Matricula, MatriculaHorario


class MatriculaService:
    """Servicio para manejar la lógica de negocio de Matrículas."""

    @classmethod
    @transaction.atomic
    def create(cls, validated_data: dict, horarios_ids: list) -> Matricula:
        """
        Crea una matrícula y asocia los horarios.
        
        Args:
            validated_data: Datos validados del serializer (sin horarios)
            horarios_ids: Lista de IDs de horarios a asociar
            
        Returns:
            Matricula: La matrícula creada
        """
        horarios_ids = horarios_ids or []

        # Calcular precio_por_sesion al crear
        precio_total = validated_data.get('precio_total', Decimal('0'))
        sesiones = validated_data.get('sesiones_contratadas', 1)
        if sesiones > 0:
            validated_data['precio_por_sesion'] = precio_total / sesiones

        matricula = Matricula.objects.create(**validated_data)
        
        for horario_id in horarios_ids:
            try:
                horario = Horario.objects.get(id=horario_id)
                MatriculaHorario.objects.create(matricula=matricula, horario=horario)
            except Horario.DoesNotExist:
                pass
        
        return matricula

    @classmethod
    @transaction.atomic
    def update(cls, instance: Matricula, validated_data: dict, horarios_ids: list = None) -> Matricula:
        """
        Actualiza una matrícula existente y replace los horarios.
        
        Args:
            instance: Instancia de la matrícula a actualizar
            validated_data: Datos validados del serializer
            horarios_ids: Lista de IDs de horarios (None para no cambiar)
            
        Returns:
            Matricula: La matrícula actualizada
        """
        horarios_ids = horarios_ids
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if horarios_ids is not None:
            instance.horarios.all().delete()
            for horario_id in horarios_ids:
                try:
                    horario = Horario.objects.get(id=horario_id)
                    MatriculaHorario.objects.create(matricula=instance, horario=horario)
                except Horario.DoesNotExist:
                    pass
        
        return instance
