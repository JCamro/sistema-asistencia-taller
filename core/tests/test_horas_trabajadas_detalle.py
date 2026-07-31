import pytest
from datetime import date

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    Asistencia, Ciclo, Horario, Matricula, MatriculaHorario, NotaClase,
    Profesor, Taller, Alumno
)
from core.models.hora_trabajada import HoraTrabajada


def _portal_docente_client(profesor):
    """Return an APIClient authenticated with a portal-docente JWT token."""
    client = APIClient()
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor.id
    refresh['dni'] = profesor.dni
    refresh['type'] = 'portal_docente'
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client


@pytest.mark.django_db
class TestProfesorHorasTrabajadasDetalle:
    def test_returns_200_with_valid_auth_and_date_range(
        self, ciclo, profesor, horario, taller, alumno, matricula, matricula_horario
    ):
        HoraTrabajada.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            fecha='2026-08-03',
            tipo='clase_regular',
            horas_trabajadas=1,
            num_alumnos=1,
            monto_profesor=17.00,
            estado='aprobada',
            observacion='',
        )

        client = _portal_docente_client(profesor)
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        assert response.status_code == 200
        assert '2026-08-03' in response.json()

    def test_groups_by_date_descending_then_workshop_then_time(
        self, ciclo, profesor, taller, horario, alumno, matricula, matricula_horario
    ):
        taller2 = Taller.objects.create(
            ciclo=ciclo, nombre='Piano', tipo='instrumento', activo=True
        )
        horario2 = Horario.objects.create(
            ciclo=ciclo, taller=taller2, profesor=profesor,
            dia_semana=2, hora_inicio='12:00', hora_fin='13:00', activo=True
        )
        matricula2 = Matricula.objects.create(
            ciclo=ciclo, alumno=alumno, taller=taller2,
            sesiones_contratadas=8, precio_total=160, precio_por_sesion=20,
            activo=True, concluida=False, fecha_matricula='2026-01-01'
        )
        MatriculaHorario.objects.create(matricula=matricula2, horario=horario2)

        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha='2026-08-03', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=17.00, estado='aprobada',
        )
        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario2,
            fecha='2026-08-03', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=20.00, estado='aprobada',
        )
        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario2,
            fecha='2026-08-05', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=20.00, estado='aprobada',
        )

        client = _portal_docente_client(profesor)
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        data = response.json()

        assert response.status_code == 200
        assert list(data.keys()) == ['2026-08-05', '2026-08-03']
        assert 'Guitarra' in data['2026-08-03']
        assert 'Piano' in data['2026-08-03']
        assert data['2026-08-03']['Guitarra'][0]['hora_inicio'] == '10:00'
        assert data['2026-08-03']['Piano'][0]['hora_inicio'] == '12:00'

    def test_includes_student_names_from_asistencia_records(
        self, ciclo, profesor, horario, matricula, matricula_horario, alumno
    ):
        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha='2026-08-03', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=17.00, estado='aprobada',
        )
        Asistencia.objects.create(
            matricula=matricula, horario=horario, profesor=profesor,
            fecha='2026-08-03', hora='10:00', estado='asistio'
        )

        client = _portal_docente_client(profesor)
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        data = response.json()

        slot = data['2026-08-03']['Guitarra'][0]
        assert len(slot['alumnos']) == 1
        assert slot['alumnos'][0]['nombre_completo'] == 'García, Ana'
        assert slot['alumnos'][0]['estado'] == 'asistio'

    def test_includes_nota_clase_contenido_when_it_exists(
        self, ciclo, profesor, horario, matricula, matricula_horario, alumno
    ):
        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha='2026-08-03', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=17.00, estado='aprobada',
        )
        Asistencia.objects.create(
            matricula=matricula, horario=horario, profesor=profesor,
            fecha='2026-08-03', hora='10:00', estado='asistio'
        )
        NotaClase.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha='2026-08-03', contenido='Clase de escalas'
        )

        client = _portal_docente_client(profesor)
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        data = response.json()

        slot = data['2026-08-03']['Guitarra'][0]
        assert slot['nota_clase'] == 'Clase de escalas'

    def test_returns_empty_dict_for_range_with_no_hours(
        self, ciclo, profesor, horario, matricula, matricula_horario
    ):
        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha='2026-07-01', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=17.00, estado='aprobada',
        )

        client = _portal_docente_client(profesor)
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        assert response.status_code == 200
        assert response.json() == {}

    def test_returns_401_without_auth(self, ciclo):
        client = APIClient()
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        assert response.status_code == 401

    def test_scoped_to_authenticated_profesor_only(
        self, ciclo, profesor, horario, taller, alumno, matricula, matricula_horario
    ):
        otro_profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Otro', apellido='Profe', dni='99999999', activo=True
        )
        HoraTrabajada.objects.create(
            profesor=otro_profesor, ciclo=ciclo, horario=horario,
            fecha='2026-08-03', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=17.00, estado='aprobada',
        )
        HoraTrabajada.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha='2026-08-04', tipo='clase_regular', horas_trabajadas=1,
            num_alumnos=1, monto_profesor=17.00, estado='aprobada',
        )

        client = _portal_docente_client(profesor)
        url = (
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/detalle/'
            '?fecha_desde=2026-08-01&fecha_hasta=2026-08-31'
        )
        response = client.get(url)
        data = response.json()

        assert response.status_code == 200
        # Both dates appear: 2026-08-04 (propia) y 2026-08-03 (sustituto)
        assert set(data.keys()) == {'2026-08-04', '2026-08-03'}

        # 2026-08-03 should be marked as sustituto
        dia_sustituto = data['2026-08-03']
        taller_key = list(dia_sustituto.keys())[0]
        slot_sustituto = dia_sustituto[taller_key][0]
        assert slot_sustituto['es_sustituto'] is True
        assert slot_sustituto['profesor_que_trabajo'] == 'Profe, Otro'
        assert slot_sustituto['monto_profesor'] == '0.00'

        # 2026-08-04 should be normal
        dia_propio = data['2026-08-04']
        slot_propio = dia_propio[taller_key][0]
        assert slot_propio['es_sustituto'] is False
        assert slot_propio['monto_profesor'] == '17.00'
