"""
Tests for the semanal/ endpoint (weekly schedule grouped by taller).
Tests: data shape, grouping, occupancy, N+1 queries, professor isolation.
"""
import pytest
from datetime import date, time
from decimal import Decimal

from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import Ciclo, Profesor, Taller, Horario, Alumno, Matricula, MatriculaHorario


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def ciclo(db):
    return Ciclo.objects.create(
        nombre='2026-A',
        tipo='anual',
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
        activo=True,
    )


@pytest.fixture
def profesor(db, ciclo):
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Carlos',
        apellido='López',
        dni='11223344',
        telefono='777777777',
        email='carlos@test.com',
        activo=True,
        es_gerente=False,
    )


@pytest.fixture
def otro_profesor(db, ciclo):
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Otro',
        apellido='Docente',
        dni='99887766',
        activo=True,
        es_gerente=False,
    )


@pytest.fixture
def taller_guitarra(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Guitarra',
        tipo='instrumento',
        activo=True,
    )


@pytest.fixture
def taller_piano(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Piano',
        tipo='instrumento',
        activo=True,
    )


@pytest.fixture
def taller_canto(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Canto',
        tipo='taller',
        activo=True,
    )


@pytest.fixture
def horario_lunes(db, ciclo, profesor, taller_guitarra):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_guitarra,
        profesor=profesor,
        dia_semana=0,  # Lunes
        hora_inicio=time(14, 0),
        hora_fin=time(15, 0),
        cupo_maximo=10,
        activo=True,
    )


@pytest.fixture
def horario_miercoles(db, ciclo, profesor, taller_piano):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_piano,
        profesor=profesor,
        dia_semana=2,  # Miércoles
        hora_inicio=time(10, 0),
        hora_fin=time(11, 30),
        cupo_maximo=8,
        activo=True,
    )


@pytest.fixture
def horario_viernes(db, ciclo, profesor, taller_guitarra):
    """Second horario for Guitarra on Friday — tests multi-horario per taller."""
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_guitarra,
        profesor=profesor,
        dia_semana=4,  # Viernes
        hora_inicio=time(16, 0),
        hora_fin=time(17, 0),
        cupo_maximo=10,
        activo=True,
    )


@pytest.fixture
def horario_otro_profesor(db, ciclo, otro_profesor, taller_canto):
    """Horario belonging to another profesor — should NOT appear."""
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_canto,
        profesor=otro_profesor,
        dia_semana=1,  # Martes
        hora_inicio=time(15, 0),
        hora_fin=time(16, 0),
        cupo_maximo=5,
        activo=True,
    )


@pytest.fixture
def alumno(db, ciclo):
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='María',
        apellido='García',
        dni='12345678',
        telefono='999888777',
        fecha_nacimiento=date(2010, 5, 15),
        activo=True,
    )


@pytest.fixture
def otro_alumno(db, ciclo):
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='Juan',
        apellido='Pérez',
        dni='87654321',
        telefono='777666555',
        fecha_nacimiento=date(2012, 3, 10),
        activo=True,
    )


@pytest.fixture
def matricula_guitarra(db, ciclo, alumno, taller_guitarra, horario_lunes):
    mat = Matricula.objects.create(
        alumno=alumno,
        ciclo=ciclo,
        taller=taller_guitarra,
        sesiones_contratadas=12,
        precio_total=Decimal('240.00'),
        precio_por_sesion=Decimal('20.00'),
        activo=True,
        concluida=False,
    )
    MatriculaHorario.objects.create(matricula=mat, horario=horario_lunes)
    return mat


@pytest.fixture
def matricula_piano(db, ciclo, otro_alumno, taller_piano, horario_miercoles):
    mat = Matricula.objects.create(
        alumno=otro_alumno,
        ciclo=ciclo,
        taller=taller_piano,
        sesiones_contratadas=8,
        precio_total=Decimal('200.00'),
        precio_por_sesion=Decimal('25.00'),
        activo=True,
        concluida=False,
    )
    MatriculaHorario.objects.create(matricula=mat, horario=horario_miercoles)
    return mat


# ---------------------------------------------------------------------------
# Auth fixtures
# ---------------------------------------------------------------------------

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


# ===========================================================================
# Tests
# ===========================================================================

class TestProfesorHorariosSemanalEndpoint:
    """Tests for GET /api/portal-docente/ciclos/{id}/horarios/semanal/"""

    ENDPOINT = '/api/portal-docente/ciclos/{}/horarios/semanal/'

    def test_returns_grouped_by_taller(
        self, authenticated_client, ciclo,
        horario_lunes, horario_miercoles, horario_viernes,
        taller_guitarra, taller_piano,
    ):
        """Response groups horarios by taller with color and metadata."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert 'talleres' in data
        assert len(data['talleres']) == 2  # Guitarra and Piano

        taller_map = {t['taller_id']: t for t in data['talleres']}

        # Guitarra has 2 horarios
        guitarra = taller_map[taller_guitarra.id]
        assert guitarra['taller_nombre'] == 'Guitarra'
        assert guitarra['taller_tipo'] == 'instrumento'
        assert isinstance(guitarra['taller_color'], str)
        assert guitarra['taller_color'].startswith('#')
        assert len(guitarra['horarios']) == 2

        # Piano has 1 horario
        piano = taller_map[taller_piano.id]
        assert piano['taller_nombre'] == 'Piano'
        assert len(piano['horarios']) == 1

    def test_horario_shape(
        self, authenticated_client, ciclo,
        horario_lunes,
    ):
        """Each horario entry has expected fields."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()

        taller = data['talleres'][0]
        h = taller['horarios'][0]

        assert 'id' in h
        assert 'dia_semana' in h
        assert 'hora_inicio' in h
        assert 'hora_fin' in h
        assert 'alumnos_count' in h
        assert 'cupo_maximo' in h
        assert 'cupo_disponible' in h
        assert 'alumnos' in h
        assert h['cupo_maximo'] == 10

    def test_cupo_disponible_with_enrolled_students(
        self, authenticated_client, ciclo,
        horario_lunes, matricula_guitarra,
    ):
        """cupo_disponible = cupo_maximo - alumnos_count."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()

        guitarra = [t for t in data['talleres'] if t['taller_nombre'] == 'Guitarra'][0]
        h = guitarra['horarios'][0]

        assert h['alumnos_count'] == 1
        assert h['cupo_disponible'] == h['cupo_maximo'] - 1

    def test_alumnos_list(
        self, authenticated_client, ciclo,
        horario_lunes, matricula_guitarra,
        alumno,
    ):
        """alumnos field contains enrolled students with details."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()

        guitarra = [t for t in data['talleres'] if t['taller_nombre'] == 'Guitarra'][0]
        alumnos = guitarra['horarios'][0]['alumnos']

        assert len(alumnos) == 1
        a = alumnos[0]
        assert a['nombre'] == 'María'
        assert a['apellido'] == 'García'
        assert a['dni'] == '12345678'

    def test_isolates_profesor(
        self, authenticated_client, ciclo,
        horario_lunes, horario_otro_profesor,
    ):
        """Only horarios belonging to the authenticated profesor are returned."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()

        # Only the profesor's horario (guitarra) should be in the response
        taller_nombres = [t['taller_nombre'] for t in data['talleres']]
        assert 'Guitarra' in taller_nombres
        assert 'Canto' not in taller_nombres  # otro_profesor's horario

    def test_empty_response(
        self, authenticated_client, ciclo,
    ):
        """Ciclo without horarios returns empty talleres list."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['talleres'] == []

    def test_no_horarios(
        self, authenticated_client, ciclo,
    ):
        """Ciclo with no horarios for the profesor returns empty talleres."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()
        assert len(data['talleres']) == 0

    def test_multiple_talleres_with_multiple_horarios(
        self, authenticated_client, ciclo,
        horario_lunes, horario_miercoles, horario_viernes,
        taller_guitarra, taller_piano,
        matricula_guitarra, matricula_piano,
    ):
        """Two talleres with multiple horarios are correctly grouped."""
        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()

        taller_map = {t['taller_id']: t for t in data['talleres']}

        g = taller_map[taller_guitarra.id]
        assert len(g['horarios']) == 2

        p = taller_map[taller_piano.id]
        assert len(p['horarios']) == 1
        assert p['horarios'][0]['alumnos_count'] == 1

    def test_cupo_disponible_never_negative(
        self, authenticated_client, ciclo,
        horario_lunes,
    ):
        """cupo_disponible is never negative even if cupo_maximo is 0."""
        horario_lunes.cupo_maximo = 0
        horario_lunes.save()

        response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
        data = response.json()

        taller = data['talleres'][0]
        h = taller['horarios'][0]
        assert h['cupo_disponible'] >= 0

    def test_unauthenticated_returns_401(
        self, api_client, ciclo,
    ):
        """Requests without token are rejected."""
        response = api_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # N+1 query count test — if django_assert_num_queries is available
    def test_num_queries(
        self, django_assert_num_queries, authenticated_client, ciclo,
        horario_lunes, horario_miercoles, horario_viernes,
        matricula_guitarra, matricula_piano,
    ):
        """Endpoint makes a constant number of queries (no N+1)."""
        # 1: profesor lookup (by DNI) + 1: horarios with Count + select_related
        # + 1: prefetch matricula_horarios__matricula__alumno = 3 total
        with django_assert_num_queries(3):
            response = authenticated_client.get(self.ENDPOINT.format(ciclo.id))
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data['talleres']) == 2
