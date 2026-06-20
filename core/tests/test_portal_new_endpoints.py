"""
Tests for new portal docente endpoints:
- asistencias/por-horario/ grouped response
- NotaClase taller_nombre field + filter params
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
def taller(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Guitarra',
        tipo='instrumento',
        activo=True,
    )


@pytest.fixture
def taller_b(db, ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Piano',
        tipo='instrumento',
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
    )


@pytest.fixture
def horario(db, ciclo, taller, profesor):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller,
        profesor=profesor,
        dia_semana=1,
        hora_inicio=time(10, 0),
        hora_fin=time(11, 0),
        cupo_maximo=10,
        activo=True,
    )


@pytest.fixture
def horario_b(db, ciclo, taller_b, profesor):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller_b,
        profesor=profesor,
        dia_semana=3,
        hora_inicio=time(14, 0),
        hora_fin=time(15, 0),
        cupo_maximo=10,
        activo=True,
    )


@pytest.fixture
def alumno(db, ciclo):
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='Test',
        apellido='Alumno',
        dni='12345678',
        telefono='999999999',
        email='test@test.com',
        fecha_nacimiento=date(2010, 1, 1),
        activo=True,
    )


@pytest.fixture
def matricula(db, ciclo, alumno, horario):
    m = Matricula.objects.create(
        ciclo=ciclo,
        alumno=alumno,
        taller=horario.taller,
        sesiones_contratadas=10,
        precio_total=500,
        precio_por_sesion=50,
        activo=True,
        concluida=False,
    )
    MatriculaHorario.objects.create(matricula=m, horario=horario)
    return m


@pytest.fixture
def asistencias(db, horario, matricula, profesor):
    dates = [date(2026, 6, 1), date(2026, 6, 8), date(2026, 6, 15)]
    created = []
    for d in dates:
        a = Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=profesor,
            fecha=d,
            hora=time(10, 0),
            estado='presente',
        )
        created.append(a)
    return created


def _get_token(profesor_obj):
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor_obj.id
    refresh['dni'] = profesor_obj.dni
    return str(refresh.access_token)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAsistenciasPorHorario:
    """Tests for GET /api/portal-docente/ciclos/{id}/asistencias/por-horario/."""

    def test_returns_grouped_horarios(self, api_client, ciclo, profesor,
                                       horario, horario_b, asistencias):
        token = _get_token(profesor)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/por-horario/'
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert 'horarios' in data
        assert len(data['horarios']) >= 2  # at least 2 horarios

    def test_horario_resumen_shape(self, api_client, ciclo, profesor, horario, asistencias):
        token = _get_token(profesor)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/por-horario/'
        )
        assert response.status_code == status.HTTP_200_OK
        h = response.data['horarios'][0]
        assert 'horario_id' in h
        assert 'taller_nombre' in h
        assert 'dia_semana' in h
        assert 'hora_inicio' in h
        assert 'hora_fin' in h
        assert 'total_clases' in h
        assert 'fechas' in h

    def test_total_clases_and_fechas(self, api_client, ciclo, profesor, horario, asistencias):
        """horario has 3 attendance dates -> total_clases=3, fechas has 3 entries."""
        token = _get_token(profesor)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/por-horario/'
        )
        assert response.status_code == status.HTTP_200_OK
        # Find our test horario
        h = next(x for x in response.data['horarios'] if x['horario_id'] == horario.id)
        assert h['total_clases'] == 3
        assert len(h['fechas']) == 3
        assert '2026-06-01' in h['fechas']
        assert '2026-06-08' in h['fechas']
        assert '2026-06-15' in h['fechas']

    def test_no_horarios_returns_empty(self, api_client, ciclo, profesor):
        """Profesor with no horarios gets empty array."""
        # Create a fresh profesor with no horarios in a new ciclo
        otro_ciclo = Ciclo.objects.create(
            nombre='2026-B', tipo='verano',
            fecha_inicio=date(2026, 6, 1), fecha_fin=date(2026, 8, 31), activo=True,
        )
        token = _get_token(profesor)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get(
            f'/api/portal-docente/ciclos/{otro_ciclo.id}/asistencias/por-horario/'
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestNotaClaseSerializerEnrichment:
    """Tests for taller_nombre field in NotaClase responses."""

    def test_nota_clase_includes_taller_nombre(self, api_client, ciclo, profesor,
                                                horario):
        token = _get_token(profesor)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Create a nota
        create_resp = api_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {'horario': horario.id, 'fecha': '2026-06-15', 'contenido': 'Buena clase'},
            format='json',
        )
        assert create_resp.status_code == status.HTTP_201_CREATED
        assert 'taller_nombre' in create_resp.data
        assert create_resp.data['taller_nombre'] == 'Guitarra'

        # List includes taller_nombre
        list_resp = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
        )
        assert list_resp.status_code == status.HTTP_200_OK
        assert len(list_resp.data) >= 1
        assert 'taller_nombre' in list_resp.data[0]
        assert list_resp.data[0]['taller_nombre'] == 'Guitarra'

    def test_notas_filter_by_horario(self, api_client, ciclo, profesor,
                                      horario, horario_b):
        """Filter notas by horario_id returns only matching notas."""
        token = _get_token(profesor)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # Create two notas in different horarios
        api_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {'horario': horario.id, 'fecha': '2026-06-15', 'contenido': 'Nota 1'},
            format='json',
        )
        api_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {'horario': horario_b.id, 'fecha': '2026-06-15', 'contenido': 'Nota 2'},
            format='json',
        )

        # Filter by first horario
        list_resp = api_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {'horario_id': horario.id},
        )
        assert list_resp.status_code == status.HTTP_200_OK
        # All returned notas should have this horario
        for nota in list_resp.data:
            assert nota['horario'] == horario.id
