"""
Tests para los serializadores de Ciclo.
"""
import pytest
from datetime import date

from core.serializers import CicloSerializer, CicloListSerializer
from core.models import Ciclo


@pytest.mark.django_db
class TestCicloSerializer:
    """Tests para CicloSerializer."""

    def test_serializer_datos_validos(self):
        """Verificar que serializador acepta datos válidos."""
        data = {
            'nombre': '2024',
            'tipo': 'anual',
            'fecha_inicio': '2024-01-01',
            'fecha_fin': '2024-12-31',
            'activo': True,
        }
        serializer = CicloSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_serializer_campos_completos(self):
        """Verificar que serializador incluye todos los campos."""
        ciclo = Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
            activo=True,
        )
        serializer = CicloSerializer(ciclo)
        data = serializer.data
        
        assert 'id' in data
        assert data['nombre'] == '2024'
        assert data['tipo'] == 'anual'
        assert data['fecha_inicio'] == '2024-01-01'
        assert data['fecha_fin'] == '2024-12-31'
        assert data['activo'] is True

    def test_serializer_campos_readonly(self):
        """Verificar que created_at y updated_at son read-only."""
        ciclo = Ciclo.objects.create(
            nombre='Test',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
        )
        serializer = CicloSerializer(ciclo)
        
        # Los campos readonly no deben aparecer en la salida al crear
        # pero pueden estar en la respuesta
        assert 'created_at' in serializer.data
        assert 'updated_at' in serializer.data

    def test_serializer_nombre_vacio_invalido(self):
        """Verificar que nombre vacío es inválido."""
        data = {
            'nombre': '',
            'tipo': 'anual',
            'fecha_inicio': '2024-01-01',
            'fecha_fin': '2024-12-31',
        }
        serializer = CicloSerializer(data=data)
        assert not serializer.is_valid()
        assert 'nombre' in serializer.errors

    def test_serializer_fecha_inicio_requerido(self):
        """Verificar que fecha_inicio es requerido."""
        data = {
            'nombre': '2024',
            'tipo': 'anual',
            'fecha_fin': '2024-12-31',
        }
        serializer = CicloSerializer(data=data)
        assert not serializer.is_valid()
        assert 'fecha_inicio' in serializer.errors

    def test_serializer_fecha_fin_requerido(self):
        """Verificar que fecha_fin es requerido."""
        data = {
            'nombre': '2024',
            'tipo': 'anual',
            'fecha_inicio': '2024-01-01',
        }
        serializer = CicloSerializer(data=data)
        assert not serializer.is_valid()
        assert 'fecha_fin' in serializer.errors


@pytest.mark.django_db
class TestCicloListSerializer:
    """Tests para CicloListSerializer."""

    def test_list_serializer_campos_limitados(self):
        """Verificar que list serializer solo incluye campos específicos."""
        ciclo = Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
            activo=True,
        )
        serializer = CicloListSerializer(ciclo)
        data = serializer.data
        
        # Debe tener estos campos
        assert 'id' in data
        assert 'nombre' in data
        assert 'tipo' in data
        assert 'fecha_inicio' in data
        assert 'fecha_fin' in data
        assert 'activo' in data
        
        # NO debe tener estos campos (son readonly)
        assert 'created_at' not in data
        assert 'updated_at' not in data

    def test_list_serializer_datos_validos(self):
        """Verificar que list serializer acepta datos válidos."""
        data = {
            'nombre': '2025',
            'tipo': 'verano',
            'fecha_inicio': '2025-01-15',
            'fecha_fin': '2025-03-15',
            'activo': False,
        }
        serializer = CicloListSerializer(data=data)
        assert serializer.is_valid(), serializer.errors