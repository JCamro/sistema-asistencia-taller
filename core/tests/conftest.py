"""
Pytest configuration and fixtures for core tests.
"""
import pytest
from datetime import date
from decimal import Decimal


@pytest.fixture
def ciclo_data():
    """Datos básicos para crear un Ciclo."""
    return {
        'nombre': '2024',
        'tipo': 'anual',
        'fecha_inicio': date(2024, 1, 1),
        'fecha_fin': date(2024, 12, 31),
        'activo': True,
    }


@pytest.fixture
def ciclo_data_verano():
    """Datos para ciclo de verano."""
    return {
        'nombre': 'Verano 2024',
        'tipo': 'verano',
        'fecha_inicio': date(2024, 1, 15),
        'fecha_fin': date(2024, 3, 15),
        'activo': True,
    }


@pytest.fixture
def alumno_data():
    """Datos básicos para crear un Alumno."""
    return {
        'nombre': 'Juan',
        'apellido': 'Pérez',
        'dni': '12345678',
        'telefono': '999999999',
        'email': 'juan@test.com',
        'fecha_nacimiento': date(2010, 5, 15),
        'activo': True,
    }


@pytest.fixture
def alumno_data_menor():
    """Datos para alumno menor de edad."""
    return {
        'nombre': 'María',
        'apellido': 'García',
        'dni': '87654321',
        'telefono': '888888888',
        'email': 'maria@test.com',
        'fecha_nacimiento': date(2015, 3, 20),
        'activo': True,
    }


@pytest.fixture
def profesor_data():
    """Datos básicos para crear un Profesor."""
    return {
        'nombre': 'Carlos',
        'apellido': 'López',
        'dni': '11223344',
        'telefono': '777777777',
        'email': 'carlos@test.com',
        'activo': True,
        'es_gerente': False,
    }


@pytest.fixture
def taller_data():
    """Datos básicos para crear un Taller."""
    return {
        'nombre': 'Guitarra',
        'tipo': 'instrumento',
        'descripcion': 'Clases de guitarra acústica',
        'activo': True,
    }


@pytest.fixture
def horario_data():
    """Datos básicos para crear un Horario."""
    return {
        'dia_semana': 0,  # Lunes
        'hora_inicio': '10:00',
        'hora_fin': '11:00',
        'cupo_maximo': 10,
    }


@pytest.fixture
def precio_paquete_data():
    """Datos básicos para crear un PrecioPaquete."""
    return {
        'tipo_taller': 'instrumento',
        'tipo_paquete': 'individual',
        'cantidad_clases': 12,
        'cantidad_clases_secundaria': None,
        'precio_total': Decimal('240.00'),
        'precio_por_sesion': Decimal('20.00'),
        'activo': True,
    }