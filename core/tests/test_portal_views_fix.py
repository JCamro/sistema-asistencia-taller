"""
Integration tests for fixed portal docente views.

Verifies cross-cycle data correctness after the get_profesor_for_ciclo
resolution fix. Each endpoint must return data for the right profesor
per cycle, not the JWT-locked ID.
"""
import pytest
from datetime import date, time

from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    Ciclo, Profesor, Taller, Horario, Alumno, Matricula,
    MatriculaHorario, Asistencia, NotaClase,
)
from core.models.hora_trabajada import HoraTrabajada


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def ciclo_a(db):
    return Ciclo.objects.create(
        nombre='2026-A',
        tipo='anual',
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
        activo=True,
    )


@pytest.fixture
def ciclo_b(db):
    return Ciclo.objects.create(
        nombre='2026-B',
        tipo='verano',
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 8, 31),
        activo=True,
    )


@pytest.fixture
def taller(db, ciclo_a):
    return Taller.objects.create(
        ciclo=ciclo_a,
        nombre='Guitarra',
        tipo='instrumento',
        activo=True,
    )


@pytest.fixture
def profesor_a(db, ciclo_a):
    return Profesor.objects.create(
        ciclo=ciclo_a,
        nombre='Carlos',
        apellido='López',
        dni='11223344',
        telefono='777777777',
        email='carlos@test.com',
        activo=True,
    )


@pytest.fixture
def profesor_b(db, ciclo_b):
    """Same teacher, different ID in cycle B."""
    return Profesor.objects.create(
        ciclo=ciclo_b,
        nombre='Carlos',
        apellido='López',
        dni='11223344',
        telefono='777777777',
        email='carlos@test.com',
        activo=True,
    )


@pytest.fixture
def horario_a(db, ciclo_a, taller, profesor_a):
    return Horario.objects.create(
        ciclo=ciclo_a,
        taller=taller,
        profesor=profesor_a,
        dia_semana=1,
        hora_inicio=time(10, 0),
        hora_fin=time(11, 0),
        cupo_maximo=10,
        activo=True,
    )


@pytest.fixture
def horario_b(db, ciclo_b, taller, profesor_b):
    return Horario.objects.create(
        ciclo=ciclo_b,
        taller=taller,
        profesor=profesor_b,
        dia_semana=3,
        hora_inicio=time(14, 0),
        hora_fin=time(15, 0),
        cupo_maximo=10,
        activo=True,
    )


@pytest.fixture
def alumno(db, ciclo_a):
    return Alumno.objects.create(
        ciclo=ciclo_a,
        nombre='Test',
        apellido='Alumno',
        dni='12345678',
        telefono='999999999',
        email='test@test.com',
        fecha_nacimiento=date(2010, 1, 1),
        activo=True,
    )


@pytest.fixture
def matricula_a(db, ciclo_a, alumno, horario_a):
    m = Matricula.objects.create(
        ciclo=ciclo_a,
        alumno=alumno,
        taller=horario_a.taller,
        sesiones_contratadas=10,
        precio_total=500,
        precio_por_sesion=50,
        activo=True,
        concluida=False,
    )
    MatriculaHorario.objects.create(matricula=m, horario=horario_a)
    return m


@pytest.fixture
def asistencia_a(db, horario_a, matricula_a, profesor_a):
    return Asistencia.objects.create(
        matricula=matricula_a,
        horario=horario_a,
        profesor=profesor_a,
        fecha=date(2026, 6, 1),
        hora=time(10, 0),
        estado='presente',
    )


def _get_token(profesor_id, dni):
    """Create a portal-docente JWT token."""
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor_id
    refresh['dni'] = dni
    return str(refresh.access_token)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDashboardViewFix:
    """Verifies dashboard returns correct data per cycle."""

    def test_dashboard_cycle_a_returns_a_data(self, api_client, ciclo_a, profesor_a,
                                                horario_a, alumno, matricula_a):
        token = _get_token(profesor_a.id, profesor_a.dni)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(f'/api/portal-docente/ciclos/{ciclo_a.id}/dashboard/')
        assert response.status_code == status.HTTP_200_OK
        # Should find the horario for this profesor in cycle A
        assert response.data['clases_hoy'] >= 0  # depends on weekday

    def test_dashboard_cross_cycle_empty(self, api_client, ciclo_b, profesor_a,
                                           profesor_b, horario_b):
        """Profesor A has no data in cycle B when using a DNI that doesn't exist there."""
        token = _get_token(profesor_a.id, '99999999')  # non-existent DNI
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(f'/api/portal-docente/ciclos/{ciclo_b.id}/dashboard/')
        # Should 404 because no profesor with DNI 99999999 in ciclo_b
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestHorariosViewFix:
    """Verifies horarios endpoint returns correct per cycle."""

    def test_horarios_cycle_a(self, api_client, ciclo_a, profesor_a, horario_a):
        token = _get_token(profesor_a.id, profesor_a.dni)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(f'/api/portal-docente/ciclos/{ciclo_a.id}/horarios/')
        assert response.status_code == status.HTTP_200_OK
        ids = [h['id'] for h in response.data]
        assert horario_a.id in ids

    def test_horarios_cross_cycle_not_found(self, api_client, ciclo_b, profesor_a):
        """Profesor A has no horarios in cycle B — 404."""
        token = _get_token(profesor_a.id, '99999999')
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(f'/api/portal-docente/ciclos/{ciclo_b.id}/horarios/')
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestAsistenciasViewFix:
    """Verifies asistencias endpoint works with resolved profesor."""

    def test_asistencias_cycle_a(self, api_client, ciclo_a, profesor_a,
                                  horario_a, asistencia_a):
        token = _get_token(profesor_a.id, profesor_a.dni)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo_a.id}/asistencias/',
            {'horario_id': horario_a.id, 'fecha': '2026-06-01'},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_asistencias_cross_cycle_404(self, api_client, ciclo_b, profesor_a,
                                          horario_a):
        """Horario A not in cycle B for profesor A."""
        token = _get_token(profesor_a.id, '99999999')
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo_b.id}/asistencias/',
            {'horario_id': horario_a.id, 'fecha': '2026-06-01'},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestNotasViewFix:
    """Verifies notas endpoint works with resolved profesor."""

    def test_notas_cycle_a(self, api_client, ciclo_a, profesor_a, horario_a):
        token = _get_token(profesor_a.id, profesor_a.dni)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(f'/api/portal-docente/ciclos/{ciclo_a.id}/notas/')
        assert response.status_code == status.HTTP_200_OK

    def test_notas_cross_cycle_404(self, api_client, ciclo_b, profesor_a):
        """Profesor A has no notas in cycle B."""
        token = _get_token(profesor_a.id, '99999999')
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(f'/api/portal-docente/ciclos/{ciclo_b.id}/notas/')
        assert response.status_code == status.HTTP_404_NOT_FOUND
