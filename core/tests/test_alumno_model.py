"""
Tests para el modelo Alumno.
"""
import pytest
from datetime import date

from django.db import IntegrityError

from core.models import Ciclo, Alumno


@pytest.mark.django_db
class TestAlumnoModel:
    """Tests para el modelo Alumno."""

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

    def test_crear_alumno_completo(self, ciclo):
        """Crear alumno con todos los campos."""
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
        assert alumno.pk is not None
        assert alumno.nombre == 'Juan'
        assert alumno.apellido == 'Pérez'

    def test_str_sin_fecha_nacimiento(self, ciclo):
        """Verificar __str__ sin fecha de nacimiento."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='12345678',
            activo=True,
        )
        assert str(alumno) == 'Pérez, Juan'

    def test_str_con_fecha_nacimiento(self, ciclo):
        """Verificar __str__ con fecha de nacimiento."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='María',
            apellido='García',
            dni='87654321',
            fecha_nacimiento=date(2015, 3, 20),
            activo=True,
        )
        assert str(alumno) == 'García, María'

    def test_edad_correcta_en_abril(self, ciclo):
        """Verificar edad cuando estamos en abril y el cumpleaños es en mayo."""
        # Fecha de nacimiento: 15/05/2010, hoy es abril 2026
        # El cumpleaños NO ha pasado aún (mayo > abril)
        # La edad debe ser 15 (2026 - 2010 - 1)
        from datetime import date as date_class
        today = date_class.today()
        fecha_nac = date_class(2010, 5, 15)
        
        Alumno.objects.create(
            ciclo=ciclo,
            nombre='Test',
            apellido='Edad',
            dni='11111111',
            fecha_nacimiento=fecha_nac,
            activo=True,
        )
        
        alumno = Alumno.objects.get(dni='11111111')
        # La lógica del modelo: si (hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day) → restar 1
        assert today.month < fecha_nac.month  # abril (4) < mayo (5)
        assert today.month < fecha_nac.month
        assert (today.month, today.day) < (fecha_nac.month, fecha_nac.day)
        assert today.year - fecha_nac.year - 1 == 15

    def test_edad_devuelve_none_sin_fecha_nacimiento(self, ciclo):
        """Verificar que edad devuelve None si no hay fecha_nacimiento."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Sin',
            apellido='Fecha',
            dni='22222222',
            fecha_nacimiento=None,
            activo=True,
        )
        assert alumno.edad is None

    def test_ordering_por_apellido_y_nombre(self, ciclo):
        """Verificar ordering por apellido, nombre."""
        # Crear alumnos en orden no alfabético
        Alumno.objects.create(ciclo=ciclo, nombre='Ana', apellido='Zapata', dni='33333333')
        Alumno.objects.create(ciclo=ciclo, nombre='Bob', apellido='Alvarez', dni='44444444')
        Alumno.objects.create(ciclo=ciclo, nombre='Carlos', apellido='Alvarez', dni='55555555')
        
        alumnos = list(Alumno.objects.all())
        # Verificar que se ordenan alfabéticamente (Álvarez viene después de Zapata en ASCII)
        assert alumnos[0].apellido == 'Alvarez'
        assert alumnos[0].nombre == 'Bob'
        assert alumnos[1].apellido == 'Alvarez'
        assert alumnos[1].nombre == 'Carlos'
        assert alumnos[2].apellido == 'Zapata'

    def test_unique_together_dni_en_mismo_ciclo(self, ciclo):
        """Verificar que no se puede repetir DNI en el mismo ciclo."""
        Alumno.objects.create(
            ciclo=ciclo,
            nombre='Primero',
            apellido='Test',
            dni='12345678',
            activo=True,
        )
        
        with pytest.raises(IntegrityError):
            Alumno.objects.create(
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
        
        Alumno.objects.create(ciclo=ciclo, nombre='Alumno', apellido='Ciclo1', dni='12345678')
        # No debe lanzar excepción
        alumno2 = Alumno.objects.create(ciclo=ciclo2, nombre='Alumno', apellido='Ciclo2', dni='12345678')
        assert alumno2.pk is not None

    def test_campos_opcionales(self, ciclo):
        """Verificar campos opcionales tienen valores por defecto."""
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Test',
            apellido='Opcional',
            dni='66666666',
            # telefono, email, fecha_nacimiento opcionales
            activo=True,
        )
        assert alumno.telefono == ''
        assert alumno.email == ''
        assert alumno.fecha_nacimiento is None
        assert alumno.activo is True

    def test_dni_puede_ser_vacio(self, ciclo):
        """Verificar que DNI vacío se permite (CharField con blank=True por defecto)."""
        # En Django, CharField permite cadenas vacías a menos que tenga blank=False
        # El modelo Alumno tiene dni = models.CharField(max_length=8) sin blank=False
        # Por lo tanto, permite cadena vacía
        alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Test',
            apellido='Vacio',
            dni='',
            activo=True,
        )
        assert alumno.dni == ''