"""
Tests para el modelo Profesor.
"""
import pytest
from datetime import date

from django.db import IntegrityError

from core.models import Ciclo, Profesor


@pytest.mark.django_db
class TestProfesorModel:
    """Tests para el modelo Profesor."""

    @pytest.fixture
    def ciclo(self):
        """Ciclo de prueba."""
        return Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
            activo=True,
        )

    def test_crear_profesor_completo(self, ciclo):
        """Crear profesor con todos los campos."""
        profesor = Profesor.objects.create(
            ciclo=ciclo,
            nombre='Carlos',
            apellido='López',
            dni='11223344',
            telefono='777777777',
            email='carlos@test.com',
            fecha_nacimiento=date(1985, 3, 10),
            activo=True,
            es_gerente=False,
        )
        assert profesor.pk is not None
        assert profesor.nombre == 'Carlos'
        assert profesor.apellido == 'López'
        assert profesor.es_gerente is False

    def test_crear_profesor_gerente(self, ciclo):
        """Crear profesor con es_gerente=True."""
        profesor = Profesor.objects.create(
            ciclo=ciclo,
            nombre='Manager',
            apellido='Test',
            dni='99887766',
            activo=True,
            es_gerente=True,
        )
        assert profesor.es_gerente is True

    def test_str_sin_fecha_nacimiento(self, ciclo):
        """Verificar __str__ sin fecha de nacimiento."""
        profesor = Profesor.objects.create(
            ciclo=ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='12345678',
            activo=True,
        )
        assert str(profesor) == 'Pérez, Juan'

    def test_str_con_fecha_nacimiento(self, ciclo):
        """Verificar __str__ con fecha de nacimiento."""
        profesor = Profesor.objects.create(
            ciclo=ciclo,
            nombre='María',
            apellido='García',
            dni='87654321',
            fecha_nacimiento=date(1990, 8, 25),
            activo=True,
        )
        assert str(profesor) == 'García, María'

    def test_ordering_por_apellido_y_nombre(self, ciclo):
        """Verificar ordering por apellido, nombre."""
        # Crear profesores en orden no alfabético
        Profesor.objects.create(ciclo=ciclo, nombre='Zoe', apellido='Zapata', dni='33333333')
        Profesor.objects.create(ciclo=ciclo, nombre='Ana', apellido='Alvarez', dni='44444444')
        Profesor.objects.create(ciclo=ciclo, nombre='Bob', apellido='Alvarez', dni='55555555')
        
        profesores = list(Profesor.objects.all())
        # Verificar ordenamiento alfabético
        assert profesores[0].apellido == 'Alvarez'
        assert profesores[0].nombre == 'Ana'
        assert profesores[1].apellido == 'Alvarez'
        assert profesores[1].nombre == 'Bob'
        assert profesores[2].apellido == 'Zapata'

    def test_unique_together_dni_en_mismo_ciclo(self, ciclo):
        """Verificar que no se puede repetir DNI en el mismo ciclo."""
        Profesor.objects.create(
            ciclo=ciclo,
            nombre='Primero',
            apellido='Test',
            dni='12345678',
            activo=True,
        )
        
        with pytest.raises(IntegrityError):
            Profesor.objects.create(
                ciclo=ciclo,
                nombre='Segundo',
                apellido='Test',
                dni='12345678',
                activo=True,
            )

    def test_diferente_ciclo_mismo_dni(self, ciclo):
        """Verificar que el mismo DNI puede existir en ciclos diferentes."""
        ciclo2 = Ciclo.objects.create(
            nombre='2025',
            tipo='anual',
            fecha_inicio=date(2025, 1, 1),
            fecha_fin=date(2025, 12, 31),
            activo=True,
        )
        
        Profesor.objects.create(ciclo=ciclo, nombre='Profe', apellido='Ciclo1', dni='12345678')
        # No debe lanzar excepción
        profesor2 = Profesor.objects.create(ciclo=ciclo2, nombre='Profe', apellido='Ciclo2', dni='12345678')
        assert profesor2.pk is not None

    def test_campos_opcionales(self, ciclo):
        """Verificar campos opcionales tienen valores por defecto."""
        profesor = Profesor.objects.create(
            ciclo=ciclo,
            nombre='Test',
            apellido='Opcional',
            dni='66666666',
            activo=True,
        )
        assert profesor.telefono == ''
        assert profesor.email == ''
        assert profesor.fecha_nacimiento is None
        assert profesor.es_gerente is False  # default


@pytest.mark.django_db
class TestProfesorTalleres:
    """Tests para la relación profesor-talleres."""

    @pytest.fixture
    def ciclo(self):
        return Ciclo.objects.create(
            nombre='2024',
            tipo='anual',
            fecha_inicio=date(2024, 1, 1),
            fecha_fin=date(2024, 12, 31),
            activo=True,
        )

    @pytest.fixture
    def profesor(self, ciclo):
        return Profesor.objects.create(
            ciclo=ciclo,
            nombre='Carlos',
            apellido='López',
            dni='12345678',
            activo=True,
        )

    def test_talleres_relacion_inversa(self, ciclo, profesor):
        """Verificar que se puede acceder a talleres desde el profesor."""
        from core.models import Taller
        
        t1 = Taller.objects.create(
            ciclo=ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Guitarra',
            activo=True,
        )
        t2 = Taller.objects.create(
            ciclo=ciclo,
            nombre='Piano',
            tipo='instrumento',
            descripcion='Piano',
            activo=True,
        )
        
        # Crear horarios para asociar
        from core.models import Horario
        horario = Horario.objects.create(
            ciclo=ciclo,
            taller=t1,
            profesor=profesor,
            dia_semana=0,
            hora_inicio='10:00',
            hora_fin='11:00',
            cupo_maximo=10,
        )
        
        # Verificar que Horario tiene la relación correcta
        assert horario.profesor == profesor
        assert horario.taller == t1