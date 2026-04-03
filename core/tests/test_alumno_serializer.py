"""
Tests para los serializadores de Alumno.
"""
import pytest
from datetime import date

from core.serializers import AlumnoSerializer, AlumnoListSerializer
from core.models import Ciclo, Alumno


@pytest.mark.django_db
class TestAlumnoSerializer:
    """Tests para AlumnoSerializer."""

    @pytest.fixture
    def ciclo(self):
        return Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
            activo=True,
        )

    def test_serializer_datos_validos(self, ciclo):
        """Verificar que serializador acepta datos válidos."""
        data = {
            'ciclo': ciclo.pk,
            'nombre': 'Juan',
            'apellido': 'Pérez',
            'dni': '12345678',
            'telefono': '999999999',
            'email': 'juan@test.com',
            'fecha_nacimiento': '2010-05-15',
            'activo': True,
        }
        serializer = AlumnoSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_serializer_campos_completos(self, ciclo):
        """Verificar que serializador incluye todos los campos."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='12345678',
            telefono='999999999',
            email='juan@test.com',
            fecha_nacimiento=date(2010, 5, 15),
            activo=True,
        )
        serializer = AlumnoSerializer(alumno)
        data = serializer.data
        
        assert 'id' in data
        assert data['nombre'] == 'Juan'
        assert data['apellido'] == 'Pérez'
        assert data['dni'] == '12345678'

    def test_serializer_campo_edad(self, ciclo):
        """Verificar que serializador incluye la edad."""
        # Alumno nacido en 2010 - en 2026 debería tener 15 o 16
        from datetime import date as date_class
        today = date_class.today()
        expected_edad = today.year - 2010 - 1 if (today.month, today.day) < (5, 15) else today.year - 2010
        
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Test',
            apellido='Edad',
            dni='11111111',
            fecha_nacimiento=date(2010, 5, 15),
            activo=True,
        )
        serializer = AlumnoSerializer(alumno)
        
        assert 'edad' in serializer.data
        assert serializer.data['edad'] >= 15

    def test_serializer_nombre_vacio_invalido(self, ciclo):
        """Verificar que nombre vacío es inválido."""
        data = {
            'ciclo': ciclo.pk,
            'nombre': '',
            'apellido': 'Pérez',
            'dni': '12345678',
        }
        serializer = AlumnoSerializer(data=data)
        assert not serializer.is_valid()
        assert 'nombre' in serializer.errors

    def test_serializer_dni_requerido(self, ciclo):
        """Verificar que DNI es requerido."""
        data = {
            'ciclo': ciclo.pk,
            'nombre': 'Juan',
            'apellido': 'Pérez',
            # dni no incluido
        }
        serializer = AlumnoSerializer(data=data)
        assert not serializer.is_valid()
        assert 'dni' in serializer.errors


@pytest.mark.django_db
class TestAlumnoListSerializer:
    """Tests para AlumnoListSerializer."""

    @pytest.fixture
    def ciclo(self):
        return Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
            activo=True,
        )

    def test_list_serializer_campos_correctos(self, ciclo):
        """Verificar que list serializer tiene campos correctos."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='12345678',
            activo=True,
        )
        serializer = AlumnoListSerializer(alumno)
        data = serializer.data
        
        # Debe tener ciclo_nombre
        assert 'ciclo_nombre' in data
        assert data['ciclo_nombre'] == '2024'
        
        # Debe tener nombre_completo
        assert 'nombre_completo' in data
        assert data['nombre_completo'] == 'Pérez, Juan'
        
        # Debe tener edad
        assert 'edad' in data

    def test_list_serializer_edad_none_sin_fecha(self, ciclo):
        """Verificar edad es None si no hay fecha_nacimiento."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Sin',
            apellido='Fecha',
            dni='22222222',
            fecha_nacimiento=None,
            activo=True,
        )
        serializer = AlumnoListSerializer(alumno)
        
        assert serializer.data['edad'] is None

    def test_list_serializer_datos_validos(self, ciclo):
        """Verificar que list serializer acepta datos válidos."""
        data = {
            'ciclo': ciclo.pk,
            'nombre': 'María',
            'apellido': 'García',
            'dni': '87654321',
            'activo': True,
        }
        serializer = AlumnoListSerializer(data=data)
        assert serializer.is_valid(), serializer.errors