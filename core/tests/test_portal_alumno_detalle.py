"""
Tests for portal docente alumno detalle consolidado endpoint (Phase 2).

Covers: single-active, multi-active (talleres_activos), no-active,
with taller_id resolution, estadisticas calculation, auth/ownership checks.
"""
import pytest
from datetime import date, time, datetime, timezone
from decimal import Decimal

from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    Alumno, Ciclo, Taller, Horario, Profesor,
    Matricula, MatriculaHorario, Asistencia,
)


# ===========================================================================
# Fixtures
# ===========================================================================

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
        apellido='Lopez',
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
        apellido='Profe',
        dni='99887766',
        telefono='666666666',
        email='otro@test.com',
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
def horario_guitarra(db, ciclo, taller_guitarra, profesor):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_guitarra,
        profesor=profesor,
        dia_semana=0,
        hora_inicio=time(10, 0),
        hora_fin=time(11, 0),
        tipo_pago='dinamico',
        activo=True,
    )


@pytest.fixture
def horario_piano(db, ciclo, taller_piano, profesor):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_piano,
        profesor=profesor,
        dia_semana=2,
        hora_inicio=time(14, 0),
        hora_fin=time(15, 0),
        tipo_pago='dinamico',
        activo=True,
    )


@pytest.fixture
def docente_token(profesor):
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor.id
    refresh['dni'] = profesor.dni
    refresh['type'] = 'portal_docente'
    return str(refresh.access_token)


@pytest.fixture
def auth_client(api_client, docente_token):
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {docente_token}')
    return api_client


# ── Helpers ───────────────────────────────────────────────────────────

def crear_matricula(alumno, taller, horario, ciclo,
                    activo=True, concluida=False,
                    sesiones=12):
    """Helper to create a Matricula + MatriculaHorario."""
    fecha = datetime(2026, 1, 15, tzinfo=datetime.now().astimezone().tzinfo)
    mat = Matricula.objects.create(
        alumno=alumno,
        ciclo=ciclo,
        taller=taller,
        sesiones_contratadas=sesiones,
        precio_total=Decimal('240.00'),
        precio_por_sesion=Decimal('20.00'),
        fecha_matricula=fecha,
        activo=activo,
        concluida=concluida,
    )
    MatriculaHorario.objects.create(matricula=mat, horario=horario)
    return mat


def crear_asistencia(matricula, horario, profesor, fecha, estado='asistio'):
    """Helper to create an Asistencia record."""
    return Asistencia.objects.create(
        matricula=matricula,
        horario=horario,
        profesor=profesor,
        fecha=fecha,
        hora=time(10, 0),
        estado=estado,
    )


# Module-level constant
ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/{}/detalle/'


# ===========================================================================
# Tests: Basic Detalle
# ===========================================================================

class TestAlumnoDetalleBasico:
    """Basic detalle endpoint: response shape, auth, ownership."""

    def test_response_shape_with_active_student(self, auth_client, ciclo,
                                                  horario_guitarra, taller_guitarra):
        """Returns all expected sections for an active student."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Alumna',
            dni='11111111', telefono='999999999', email='ana@test.com',
        )
        crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                        activo=True, concluida=False)

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        assert 'alumno' in data
        assert 'talleres_activos' in data
        assert 'matricula_activa' in data
        assert 'matriculas_historicas' in data
        assert 'estadisticas' in data
        assert data['alumno']['nombre'] == 'Ana'

    def test_401_unauthenticated(self, api_client, ciclo, horario_guitarra, taller_guitarra):
        """Unauthenticated request returns 401."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Alumna',
            dni='11111111', telefono='', email='',
        )
        response = api_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_404_unauthorized_student(self, auth_client, ciclo, otro_profesor,
                                       horario_guitarra, taller_guitarra):
        """Professor gets 404 for another professor's student."""
        otro_horario = Horario.objects.create(
            ciclo=ciclo, taller=taller_guitarra, profesor=otro_profesor,
            dia_semana=1, hora_inicio=time(12, 0), hora_fin=time(13, 0),
            activo=True,
        )
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Otro', apellido='Alumno',
            dni='55555555', telefono='', email='',
        )
        crear_matricula(alumno, taller_guitarra, otro_horario, ciclo)

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# Tests: Single Active Matricula
# ===========================================================================

class TestSingleActiveMatricula:
    """Student with exactly one active matricula."""

    def test_single_active_returns_matricula_activa(self, auth_client, ciclo,
                                                     horario_guitarra, taller_guitarra):
        """Single active matricula populates matricula_activa."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Unica',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                        activo=True, concluida=False)

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        assert data['talleres_activos'] is None
        assert data['matricula_activa'] is not None
        assert data['matricula_activa']['taller_nombre'] == 'Guitarra'
        assert data['matricula_activa']['dia_semana'] == 0
        assert data['matricula_activa']['sesiones_contratadas'] == 12

    def test_single_active_with_sesiones_disponibles(self, auth_client, ciclo,
                                                      horario_guitarra, taller_guitarra,
                                                      profesor):
        """sesiones_consumidas and sesiones_disponibles are calculated."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Progre', apellido='Sivo',
            dni='11111111', telefono='', email='',
        )
        mat = crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                              activo=True, concluida=False, sesiones=12)
        for i in range(3):
            crear_asistencia(mat, horario_guitarra, profesor,
                             date(2026, 6, 1 + i))

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK
        ma = response.data['matricula_activa']
        assert ma['sesiones_consumidas'] == 3
        assert ma['sesiones_disponibles'] == 9


# ===========================================================================
# Tests: Multiple Active Matriculas
# ===========================================================================

class TestMultiActiveMatriculas:
    """Student with multiple active matriculas."""

    def test_multi_active_returns_talleres_activos(self, auth_client, ciclo,
                                                    horario_guitarra, horario_piano,
                                                    taller_guitarra, taller_piano):
        """Multiple active matriculas return talleres_activos list."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Multi', apellido='Activo',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                        activo=True, concluida=False)
        crear_matricula(alumno, taller_piano, horario_piano, ciclo,
                        activo=True, concluida=False)

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        assert data['matricula_activa'] is None
        assert data['talleres_activos'] is not None
        assert len(data['talleres_activos']) == 2

        taller_nombres = [t['taller_nombre'] for t in data['talleres_activos']]
        assert 'Guitarra' in taller_nombres
        assert 'Piano' in taller_nombres

    def test_multi_active_with_taller_id_resolves(self, auth_client, ciclo,
                                                    horario_guitarra, horario_piano,
                                                    taller_guitarra, taller_piano):
        """?taller_id resolves matricula_activa from multiple active."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Multi', apellido='Activo',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                        activo=True, concluida=False)
        crear_matricula(alumno, taller_piano, horario_piano, ciclo,
                        activo=True, concluida=False)

        response = auth_client.get(
            ENDPOINT.format(ciclo.id, alumno.id),
            {'taller_id': taller_guitarra.id},
        )
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        assert data['matricula_activa'] is not None
        assert data['matricula_activa']['taller_nombre'] == 'Guitarra'
        assert data['talleres_activos'] is None


# ===========================================================================
# Tests: No Active Matricula
# ===========================================================================

class TestNoActiveMatricula:
    """Student with no active matriculas (all historical)."""

    def test_no_active_returns_null_matricula_activa(self, auth_client, ciclo,
                                                      horario_guitarra, taller_guitarra):
        """Student with only historical matriculas has matricula_activa=null."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                        activo=True, concluida=True)

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        assert data['matricula_activa'] is None
        assert len(data['matriculas_historicas']) >= 1

    def test_historical_matriculas_listed(self, auth_client, ciclo,
                                           horario_guitarra, taller_guitarra):
        """Historical matriculas are listed with key fields."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='11111111', telefono='', email='',
        )
        mat1 = crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                               activo=True, concluida=True, sesiones=12)
        # Force different fecha_matricula for deterministic ordering
        Matricula.objects.filter(id=mat1.id).update(
            fecha_matricula=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        mat2 = crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                               activo=True, concluida=True, sesiones=8)
        Matricula.objects.filter(id=mat2.id).update(
            fecha_matricula=datetime(2026, 2, 1, tzinfo=timezone.utc),
        )

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        historicas = response.data['matriculas_historicas']
        assert len(historicas) == 2
        # Most recent first (by fecha_matricula desc): mat2 (Feb) before mat1 (Jan)
        assert historicas[0]['id'] == mat2.id
        assert historicas[1]['id'] == mat1.id


# ===========================================================================
# Tests: Estadisticas
# ===========================================================================

class TestEstadisticas:
    """Tests for global estadisticas calculation."""

    def test_statistics_calculation(self, auth_client, ciclo, profesor,
                                     horario_guitarra, taller_guitarra):
        """tasa_asistencia, total_asistencias, total_faltas are correct."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Stats', apellido='Test',
            dni='11111111', telefono='', email='',
        )
        mat = crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                              activo=True, concluida=False)

        # 16 asistencias, 4 faltas = 20 total, 80% rate
        for i in range(16):
            crear_asistencia(mat, horario_guitarra, profesor,
                             date(2026, 6, 1 + i), estado='asistio')
        for i in range(4):
            crear_asistencia(mat, horario_guitarra, profesor,
                             date(2026, 7, 1 + i), estado='falta')

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        # No taller_id → per-taller breakdown
        por_taller = response.data['estadisticas_por_taller']
        assert response.data['estadisticas'] is None
        assert len(por_taller) == 1
        assert por_taller[0]['tasa_asistencia'] == 80.0
        assert por_taller[0]['total_asistencias'] == 16
        assert por_taller[0]['total_faltas'] == 4

    def test_zero_sessions_returns_zero_rate(self, auth_client, ciclo,
                                              horario_guitarra, taller_guitarra):
        """Student with no sessions has 0.0 tasa_asistencia."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Zero', apellido='Sessions',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller_guitarra, horario_guitarra, ciclo,
                        activo=True, concluida=False)

        response = auth_client.get(ENDPOINT.format(ciclo.id, alumno.id))
        assert response.status_code == status.HTTP_200_OK

        # No taller_id → per-taller breakdown
        por_taller = response.data['estadisticas_por_taller']
        assert response.data['estadisticas'] is None
        assert len(por_taller) == 1
        assert por_taller[0]['tasa_asistencia'] == 0.0
        assert por_taller[0]['total_asistencias'] == 0
        assert por_taller[0]['total_faltas'] == 0
