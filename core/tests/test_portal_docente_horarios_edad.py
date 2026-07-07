"""
Tests for HorarioConAlumnosSerializer edad field.
Phase 7: Backend tests for edad annotation on portal docente horarios endpoint.

Covers:
- Alumno with fecha_nacimiento → edad calculated correctly
- Alumno without fecha_nacimiento → edad is null (null-safe)
- dni and telefono are NOT in serialized output
"""
import pytest
from datetime import date, time, datetime, timezone
from decimal import Decimal
from rest_framework.test import APIClient
from rest_framework import status

from core.models import Ciclo, Taller, Horario, Profesor, Alumno, Matricula, MatriculaHorario
from core.serializers.portal_docente.serializers import HorarioConAlumnosSerializer
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture
def api_client():
    """API client for testing."""
    return APIClient()


@pytest.fixture
def ciclo(db):
    return Ciclo.objects.create(
        nombre='2026-A', tipo='anual',
        fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
        activo=True,
    )


@pytest.fixture
def profesor(db, ciclo):
    return Profesor.objects.create(
        ciclo=ciclo, nombre='Carlos', apellido='López',
        dni='11223344', telefono='777777777',
        email='carlos@test.com', activo=True, es_gerente=False,
    )


@pytest.fixture
def taller(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo, nombre='Guitarra', tipo='instrumento',
        activo=True,
    )


@pytest.fixture
def horario(db, ciclo, taller, profesor):
    return Horario.objects.create(
        ciclo=ciclo, taller=taller, profesor=profesor,
        dia_semana=0, hora_inicio=time(10, 0), hora_fin=time(11, 0),
        tipo_pago='dinamico', activo=True,
    )


@pytest.fixture
def docente_token(profesor):
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor.id
    refresh['dni'] = profesor.dni
    refresh['type'] = 'portal_docente'
    return str(refresh.access_token)


@pytest.fixture
def authenticated_client(api_client, docente_token):
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {docente_token}')
    return api_client


# ---------------------------------------------------------------------------
# Tests: Serializer edad calculation
# ---------------------------------------------------------------------------

class TestHorarioConAlumnosEdad:
    """Tests for the edad annotation in HorarioConAlumnosSerializer."""

    def test_alumno_with_fecha_nacimiento_has_edad(self, db, ciclo, horario):
        """Alumno with fecha_nacimiento should have edad calculated."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', telefono='999999999',
            email='juan@test.com',
            fecha_nacimiento=date(2016, 5, 15),
            activo=True,
        )
        mat = Matricula.objects.create(
            alumno=alumno, ciclo=ciclo, taller=horario.taller,
            sesiones_contratadas=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'),
            fecha_matricula=datetime(2026, 1, 15, tzinfo=timezone.utc),
            activo=True, concluida=False,
        )
        MatriculaHorario.objects.create(matricula=mat, horario=horario)

        serializer = HorarioConAlumnosSerializer(horario)
        alumnos_data = serializer.data['alumnos']

        assert len(alumnos_data) == 1
        alumno_data = alumnos_data[0]
        assert 'edad' in alumno_data
        # In 2026, a person born 2016-05-15 turns 10 on May 15
        # Today is 2026-06-13, so edad should be 10
        expected_edad = 2026 - 2016  # = 10 (birthday already passed since May 15 < Jun 13)
        assert alumno_data['edad'] == expected_edad, \
            f"Expected edad={expected_edad}, got {alumno_data['edad']}"

    def test_alumno_without_fecha_nacimiento_edad_null(self, db, ciclo, horario):
        """Alumno without fecha_nacimiento should have edad=null (null-safe)."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='María', apellido='García',
            dni='87654321', telefono='888888888',
            email='maria@test.com',
            fecha_nacimiento=None,  # No birth date
            activo=True,
        )
        mat = Matricula.objects.create(
            alumno=alumno, ciclo=ciclo, taller=horario.taller,
            sesiones_contratadas=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'),
            fecha_matricula=datetime(2026, 1, 15, tzinfo=timezone.utc),
            activo=True, concluida=False,
        )
        MatriculaHorario.objects.create(matricula=mat, horario=horario)

        serializer = HorarioConAlumnosSerializer(horario)
        alumnos_data = serializer.data['alumnos']

        assert len(alumnos_data) == 1
        assert 'edad' in alumnos_data[0]
        assert alumnos_data[0]['edad'] is None, \
            f"Expected edad=None for student without fecha_nacimiento, got {alumnos_data[0]['edad']}"

    def test_dni_and_telefono_not_in_output(self, db, ciclo, horario):
        """dni and telefono should NOT be in the serialized alumnos output."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Carlos', apellido='López',
            dni='11223344', telefono='666666666',
            email='carlos@test.com',
            fecha_nacimiento=date(2014, 3, 10),
            activo=True,
        )
        mat = Matricula.objects.create(
            alumno=alumno, ciclo=ciclo, taller=horario.taller,
            sesiones_contratadas=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'),
            fecha_matricula=datetime(2026, 1, 15, tzinfo=timezone.utc),
            activo=True, concluida=False,
        )
        MatriculaHorario.objects.create(matricula=mat, horario=horario)

        serializer = HorarioConAlumnosSerializer(horario)
        alumnos_data = serializer.data['alumnos']

        assert len(alumnos_data) == 1
        alumno_keys = set(alumnos_data[0].keys())
        # Should have these keys (dni/telefono added intentionally)
        assert alumno_keys == {'id', 'nombre', 'apellido', 'dni', 'telefono', 'edad'}, \
            f"Expected keys {{'id','nombre','apellido','dni','telefono','edad'}}, got {alumno_keys}"


# ---------------------------------------------------------------------------
# Tests: Endpoint returns alumnos with edad
# ---------------------------------------------------------------------------

class TestHorarioEndpointEdad:
    """Tests that the GET horarios endpoint returns alumnos with edad."""

    def test_endpoint_returns_alumnos_with_edad(self, authenticated_client, ciclo, horario):
        """The API endpoint should return alumnos with edad field."""
        # Create student with birth date
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Test', apellido='Student',
            dni='12345678', telefono='999999999',
            email='test@test.com',
            fecha_nacimiento=date(2010, 1, 1),
            activo=True,
        )
        mat = Matricula.objects.create(
            alumno=alumno, ciclo=ciclo, taller=horario.taller,
            sesiones_contratadas=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'),
            fecha_matricula=datetime(2026, 1, 15, tzinfo=timezone.utc),
            activo=True, concluida=False,
        )
        MatriculaHorario.objects.create(matricula=mat, horario=horario)

        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/horarios/'
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

        # Check that at least one horario has alumnos with edad
        found_edad = False
        for h in response.data:
            for a in h.get('alumnos', []):
                assert 'edad' in a, "Each alumno must have 'edad' field"
                if a['edad'] is not None:
                    found_edad = True
                # dni and telefono should be present (enriched per spec)
                assert 'dni' in a, "dni should be in response"
                assert 'telefono' in a, "telefono should be in response"

        assert found_edad, "At least one alumno should have non-null edad"
