import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from core.models import Ciclo, Taller, Profesor, Alumno, Horario, Matricula, MatriculaHorario


@pytest.fixture
def usuario():
    return User.objects.create_user(username='testuser', password='testpass')


@pytest.fixture
def cliente_autenticado(usuario):
    client = APIClient()
    response = client.post('/api/auth/login/', {
        'username': 'testuser',
        'password': 'testpass'
    }, format='json')
    token = response.json()['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@pytest.fixture
def ciclo():
    return Ciclo.objects.create(
        nombre='Ciclo 2026',
        tipo='anual',
        fecha_inicio='2026-01-01',
        fecha_fin='2026-12-31'
    )


@pytest.fixture
def taller(ciclo):
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Guitarra',
        tipo='instrumento',
        activo=True
    )


@pytest.fixture
def profesor(ciclo):
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Juan',
        apellido='Pérez',
        dni='12345678',
        activo=True
    )


@pytest.fixture
def alumno(ciclo):
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='Ana',
        apellido='García',
        dni='87654321',
        activo=True
    )


@pytest.fixture
def horario(ciclo, taller, profesor):
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller,
        profesor=profesor,
        dia_semana=1,
        hora_inicio='10:00',
        hora_fin='11:00',
        activo=True
    )


@pytest.fixture
def matricula(ciclo, alumno, taller):
    return Matricula.objects.create(
        ciclo=ciclo,
        alumno=alumno,
        taller=taller,
        sesiones_contratadas=8,
        precio_total=160,
        precio_por_sesion=20,
        activo=True,
        concluida=False
    )


@pytest.fixture
def matricula_horario(matricula, horario):
    return MatriculaHorario.objects.create(
        matricula=matricula,
        horario=horario
    )
