"""
Tests for portal docente cartilla redesign (Phase 1).

Covers: estado annotation (activo/historico), pagination envelope,
?estado filter, ?search + ?taller_id + ?dia_semana + ?hora combined filters,
fecha_ultima_asistencia annotation, ordering.
"""
import pytest
from datetime import date, time, datetime
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
def taller(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Guitarra',
        tipo='instrumento',
        descripcion='Clases de guitarra',
        activo=True,
    )


@pytest.fixture
def taller_piano(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Piano',
        tipo='instrumento',
        descripcion='Clases de piano',
        activo=True,
    )


@pytest.fixture
def horario(db, ciclo, taller, profesor):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller,
        profesor=profesor,
        dia_semana=0,  # Lunes
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
        dia_semana=2,  # Miercoles
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


# ── Helper: create matricula + MatriculaHorario ────────────────────────

def crear_matricula(alumno, taller, horario, ciclo,
                    activo=True, concluida=False,
                    sesiones=12, fecha=None):
    """Helper to create a Matricula + MatriculaHorario."""
    if fecha is None:
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


# ===========================================================================
# Tests: Estado annotation
# ===========================================================================

class TestEstadoAnnotation:
    """Tests for the estado (activo/historico) annotation."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/'

    def test_active_student_estado_activo(self, auth_client, ciclo, profesor, horario, taller):
        """Student with active, non-concluded matricula has estado='activo'."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Activa',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller, horario, ciclo, activo=True, concluida=False)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert len(results) == 1
        assert results[0]['estado'] == 'activo'

    def test_historical_student_estado_historico(self, auth_client, ciclo, profesor, horario, taller):
        """Student with concluded matricula has estado='historico'."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(alumno, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert len(results) == 1
        assert results[0]['estado'] == 'historico'

    def test_inactive_matricula_is_historico(self, auth_client, ciclo, profesor, horario, taller):
        """Student with inactive (activo=False) matricula has estado='historico'."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Inac', apellido='Tivo',
            dni='33333333', telefono='', email='',
        )
        crear_matricula(alumno, taller, horario, ciclo, activo=False, concluida=False)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert len(results) == 1
        assert results[0]['estado'] == 'historico'

    def test_active_and_historical_together(self, auth_client, ciclo, profesor, horario, taller):
        """Both active and historical students appear in the same response."""
        activo = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Activa',
            dni='11111111', telefono='', email='',
        )
        historico = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(activo, taller, horario, ciclo, activo=True, concluida=False)
        crear_matricula(historico, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert len(results) == 2

        estados = {r['id']: r['estado'] for r in results}
        assert estados[activo.id] == 'activo'
        assert estados[historico.id] == 'historico'


# ===========================================================================
# Tests: Pagination
# ===========================================================================

class TestPagination:
    """Tests for paginated response envelope."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/'

    def test_paginated_response_shape(self, auth_client, ciclo, profesor, horario, taller):
        """Response has count, next, previous, results keys."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Paginada',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller, horario, ciclo)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        assert 'count' in response.data
        assert 'next' in response.data
        assert 'previous' in response.data
        assert 'results' in response.data
        assert response.data['count'] == 1
        assert response.data['next'] is None
        assert response.data['previous'] is None

    def test_pagination_with_multiple_pages(self, auth_client, ciclo, profesor, horario, taller):
        """With 25 students, first page has 20, second has 5."""
        for i in range(25):
            alumno = Alumno.objects.create(
                ciclo=ciclo, nombre=f'Nombre{i}', apellido=f'Alumno{i:03d}',
                dni=f'{11111100 + i:08d}', telefono='', email='',
            )
            crear_matricula(alumno, taller, horario, ciclo)

        # Page 1
        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'page': 1})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 20
        assert response.data['count'] == 25
        assert response.data['next'] is not None
        assert response.data['previous'] is None

        # Page 2
        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'page': 2})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 5
        assert response.data['next'] is None
        assert response.data['previous'] is not None

    def test_empty_response(self, auth_client, ciclo):
        """Returns paginated response with empty results when no students."""
        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0
        assert len(response.data['results']) == 0


# ===========================================================================
# Tests: ?estado filter
# ===========================================================================

class TestEstadoFilter:
    """Tests for the ?estado query parameter filter."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/'

    def test_filter_activo_only(self, auth_client, ciclo, profesor, horario, taller):
        """?estado=activo returns only active students."""
        activo = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Activa',
            dni='11111111', telefono='', email='',
        )
        historico = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(activo, taller, horario, ciclo, activo=True, concluida=False)
        crear_matricula(historico, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'estado': 'activo'})
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert len(results) == 1
        assert results[0]['id'] == activo.id
        assert results[0]['estado'] == 'activo'

    def test_filter_historico_only(self, auth_client, ciclo, profesor, horario, taller):
        """?estado=historico returns only historical students."""
        activo = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Activa',
            dni='11111111', telefono='', email='',
        )
        historico = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(activo, taller, horario, ciclo, activo=True, concluida=False)
        crear_matricula(historico, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'estado': 'historico'})
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert len(results) == 1
        assert results[0]['id'] == historico.id
        assert results[0]['estado'] == 'historico'

    def test_filter_todos_default(self, auth_client, ciclo, profesor, horario, taller):
        """Default (?estado=todos) returns both active and historical."""
        activo = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Activa',
            dni='11111111', telefono='', email='',
        )
        historico = Alumno.objects.create(
            ciclo=ciclo, nombre='Histo', apellido='Rico',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(activo, taller, horario, ciclo, activo=True, concluida=False)
        crear_matricula(historico, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'estado': 'todos'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 2


# ===========================================================================
# Tests: fecha_ultima_asistencia annotation
# ===========================================================================

class TestFechaUltimaAsistencia:
    """Tests for the fecha_ultima_asistencia annotation."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/'

    def test_student_with_attendance(self, auth_client, ciclo, profesor, horario, taller):
        """Student with attendance records has fecha_ultima_asistencia set."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Asiste',
            dni='11111111', telefono='', email='',
        )
        mat = crear_matricula(alumno, taller, horario, ciclo, activo=True, concluida=False)

        # Create attendance on two dates
        Asistencia.objects.create(
            matricula=mat, horario=horario, profesor=profesor,
            fecha=date(2026, 6, 1), hora=time(10, 0), estado='asistio',
        )
        Asistencia.objects.create(
            matricula=mat, horario=horario, profesor=profesor,
            fecha=date(2026, 6, 15), hora=time(10, 0), estado='asistio',
        )

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert results[0]['fecha_ultima_asistencia'] == date(2026, 6, 15)

    def test_student_with_no_attendance(self, auth_client, ciclo, profesor, horario, taller):
        """Student with zero attendance records has null fecha_ultima_asistencia."""
        alumno = Alumno.objects.create(
            ciclo=ciclo, nombre='Sin', apellido='Asistencia',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(alumno, taller, horario, ciclo)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        assert results[0]['fecha_ultima_asistencia'] is None


# ===========================================================================
# Tests: Combined cascade filters
# ===========================================================================

class TestCascadeFilters:
    """Tests for combined ?search + ?taller_id + ?dia_semana + ?hora filters."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/'

    def test_search_filter(self, auth_client, ciclo, profesor, horario, taller):
        """?search filters by nombre/apellido/dni."""
        alumno1 = Alumno.objects.create(
            ciclo=ciclo, nombre='Maria', apellido='Garcia',
            dni='11111111', telefono='', email='',
        )
        alumno2 = Alumno.objects.create(
            ciclo=ciclo, nombre='Jose', apellido='Lopez',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(alumno1, taller, horario, ciclo)
        crear_matricula(alumno2, taller, horario, ciclo)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'search': 'maria'})
        assert response.status_code == status.HTTP_200_OK
        ids = [r['id'] for r in response.data['results']]
        assert alumno1.id in ids
        assert alumno2.id not in ids

    def test_taller_filter(self, auth_client, ciclo, profesor, horario, horario_piano, taller, taller_piano):
        """?taller_id filters by taller."""
        g = Alumno.objects.create(
            ciclo=ciclo, nombre='Guitarrista', apellido='Uno',
            dni='11111111', telefono='', email='',
        )
        p = Alumno.objects.create(
            ciclo=ciclo, nombre='Pianista', apellido='Dos',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(g, taller, horario, ciclo)
        crear_matricula(p, taller_piano, horario_piano, ciclo)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'taller_id': taller.id})
        assert response.status_code == status.HTTP_200_OK
        ids = [r['id'] for r in response.data['results']]
        assert g.id in ids
        assert p.id not in ids

    def test_dia_semana_filter(self, auth_client, ciclo, profesor, horario, horario_piano, taller, taller_piano):
        """?dia_semana filters by day of week."""
        lunes = Alumno.objects.create(
            ciclo=ciclo, nombre='Lunes', apellido='Student',
            dni='11111111', telefono='', email='',
        )
        miercoles = Alumno.objects.create(
            ciclo=ciclo, nombre='Miercoles', apellido='Student',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(lunes, taller, horario, ciclo)           # dia_semana=0
        crear_matricula(miercoles, taller_piano, horario_piano, ciclo)  # dia_semana=2

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'dia_semana': '0'})
        assert response.status_code == status.HTTP_200_OK
        ids = [r['id'] for r in response.data['results']]
        assert lunes.id in ids
        assert miercoles.id not in ids

    def test_hora_filter(self, auth_client, ciclo, profesor, horario, horario_piano, taller, taller_piano):
        """?hora filters by hora_inicio hour."""
        diez = Alumno.objects.create(
            ciclo=ciclo, nombre='Diez', apellido='AM',
            dni='11111111', telefono='', email='',
        )
        catorce = Alumno.objects.create(
            ciclo=ciclo, nombre='Catorce', apellido='PM',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(diez, taller, horario, ciclo)           # hora=10
        crear_matricula(catorce, taller_piano, horario_piano, ciclo)  # hora=14

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'hora': '10'})
        assert response.status_code == status.HTTP_200_OK
        ids = [r['id'] for r in response.data['results']]
        assert diez.id in ids
        assert catorce.id not in ids

    def test_combined_filters(self, auth_client, ciclo, profesor,
                              horario, horario_piano, taller, taller_piano):
        """?estado + ?taller_id + ?search combine with AND."""
        # Active student in Guitarra
        ana = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Activa',
            dni='11111111', telefono='', email='',
        )
        crear_matricula(ana, taller, horario, ciclo, activo=True, concluida=False)

        # Historical student in Guitarra named Ana
        hist_ana = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Historica',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(hist_ana, taller, horario, ciclo, activo=True, concluida=True)

        # Active student in Piano named Ana
        piano_ana = Alumno.objects.create(
            ciclo=ciclo, nombre='Ana', apellido='Pianista',
            dni='33333333', telefono='', email='',
        )
        crear_matricula(piano_ana, taller_piano, horario_piano, ciclo, activo=True, concluida=False)

        # Active in Guitarra, search "Ana"
        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {
            'estado': 'activo', 'taller_id': str(taller.id), 'search': 'Ana',
        })
        assert response.status_code == status.HTTP_200_OK
        ids = [r['id'] for r in response.data['results']]
        assert ana.id in ids, 'Active Ana in Guitarra should match'
        assert hist_ana.id not in ids, 'Historical Ana in Guitarra excluded by estado=activo'
        assert piano_ana.id not in ids, 'Ana in Piano excluded by taller_id=Guitarra'


# ===========================================================================
# Tests: Ordering
# ===========================================================================

class TestOrdering:
    """Tests for correct ordering: activos first, then historicos, both by apellido."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/alumnos/'

    def test_activos_first_then_historicos(self, auth_client, ciclo, profesor, horario, taller):
        """Active students come before historical students."""
        h1 = Alumno.objects.create(
            ciclo=ciclo, nombre='Zeta', apellido='Zeta',
            dni='11111111', telefono='', email='',
        )
        a1 = Alumno.objects.create(
            ciclo=ciclo, nombre='Alpha', apellido='Alpha',
            dni='22222222', telefono='', email='',
        )
        h2 = Alumno.objects.create(
            ciclo=ciclo, nombre='Beta', apellido='Beta',
            dni='33333333', telefono='', email='',
        )
        a2 = Alumno.objects.create(
            ciclo=ciclo, nombre='Gamma', apellido='Gamma',
            dni='44444444', telefono='', email='',
        )
        crear_matricula(a1, taller, horario, ciclo, activo=True, concluida=False)
        crear_matricula(a2, taller, horario, ciclo, activo=True, concluida=False)
        crear_matricula(h1, taller, horario, ciclo, activo=True, concluida=True)
        crear_matricula(h2, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id))
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        # Order: Alpha (activo), Gamma (activo), Beta (historico), Zeta (historico)
        expected_order = [a1.id, a2.id, h2.id, h1.id]
        actual_order = [r['id'] for r in results]
        assert actual_order == expected_order, f'Expected {expected_order}, got {actual_order}'

    def test_ordering_with_estado_filter_preserved(self, auth_client, ciclo, profesor, horario, taller):
        """Ordering is preserved when estado filter is applied."""
        h1 = Alumno.objects.create(
            ciclo=ciclo, nombre='Zeta', apellido='Zeta',
            dni='11111111', telefono='', email='',
        )
        h2 = Alumno.objects.create(
            ciclo=ciclo, nombre='Beta', apellido='Beta',
            dni='22222222', telefono='', email='',
        )
        crear_matricula(h1, taller, horario, ciclo, activo=True, concluida=True)
        crear_matricula(h2, taller, horario, ciclo, activo=True, concluida=True)

        response = auth_client.get(self.ENDPOINT.format(ciclo.id), {'estado': 'historico'})
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        # Ordered by apellido: Beta, Zeta
        expected_order = [h2.id, h1.id]
        actual_order = [r['id'] for r in results]
        assert actual_order == expected_order
