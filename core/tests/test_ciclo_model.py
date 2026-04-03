"""
Tests para el modelo Ciclo.
"""
import pytest
from datetime import date
from decimal import Decimal

from core.models import Ciclo


@pytest.mark.django_db
class TestCicloModel:
    """Tests para el modelo Ciclo."""

    def test_crear_ciclo_minimo(self):
        """Crear ciclo solo con campos requeridos."""
        ciclo = Ciclo.objects.create(
            nombre='2024',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        assert ciclo.pk is not None
        assert ciclo.nombre == '2024'
        assert ciclo.activo is True  # default

    def test_str_con_tipo(self):
        """Verificar __str__ incluye el tipo."""
        ciclo = Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        assert str(ciclo) == '2024 (anual)'

    def test_str_tipo_verano(self):
        """Verificar __str__ con tipo verano."""
        ciclo = Ciclo.objects.create(
            nombre='Verano 2024',
            tipo='verano',
            fecha_inicio=date(2024, 1, 15),
            fecha_fin=date(2024, 3, 15),
        )
        assert str(ciclo) == 'Verano 2024 (verano)'

    def test_str_tipo_otro(self):
        """Verificar __str__ con tipo otro."""
        ciclo = Ciclo.objects.create(
            nombre='Ciclo Especial',
            tipo='otro',
            fecha_inicio=date(2024, 6, 1),
            fecha_fin=date(2024, 8, 31),
        )
        assert str(ciclo) == 'Ciclo Especial (otro)'

    def test_ordering_por_fecha_inicio_desc(self):
        """Verificar ordering por fecha_inicio descendente."""
        ciclo1 = Ciclo.objects.create(
            nombre='Ciclo 2024',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        ciclo2 = Ciclo.objects.create(
            nombre='Ciclo 2025',
            fecha_inicio=date(2025, 1, 1),
            fecha_fin=date(2025, 12, 31),
        )
        ciclos = list(Ciclo.objects.all())
        assert ciclos[0] == ciclo2  # Más reciente primero

    def test_campos_opcionales(self):
        """Verificar campos opcionales tienen valores por defecto."""
        ciclo = Ciclo.objects.create(
            nombre='Test',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        assert ciclo.tipo == 'anual'  # default
        assert ciclo.activo is True  # default
        assert ciclo.created_at is not None
        assert ciclo.updated_at is not None

    def test_update_ciclo(self):
        """Verificar que se puede actualizar un ciclo."""
        ciclo = Ciclo.objects.create(
            nombre='Original',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        ciclo.nombre = 'Actualizado'
        ciclo.save()
        
        ciclo.refresh_from_db()
        assert ciclo.nombre == 'Actualizado'

    def test_delete_ciclo(self):
        """Verificar que se puede eliminar un ciclo."""
        ciclo = Ciclo.objects.create(
            nombre='Delete Test',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        pk = ciclo.pk
        ciclo.delete()
        
        assert Ciclo.objects.filter(pk=pk).count() == 0