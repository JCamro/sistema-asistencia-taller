import pytest
from datetime import date, timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import Asistencia, Horario, Matricula, MatriculaHorario, Profesor, Taller


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
class TestHorarioResumenFecha:
    def test_missing_fecha_returns_400(self, ciclo, horario, profesor):
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/'
        response = client.get(url)
        assert response.status_code == 400
        assert response.json()['detail'] == "Parameter 'fecha' is required (YYYY-MM-DD)."

    def test_invalid_fecha_returns_400(self, ciclo, horario, profesor):
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha=not-a-date'
        response = client.get(url)
        assert response.status_code == 400
        assert response.json()['detail'] == "Fecha inválida. Use formato YYYY-MM-DD."

    def test_horario_from_other_profesor_returns_404(self, ciclo, taller, profesor):
        otro_profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Otro', apellido='Profe', dni='99999999', activo=True
        )
        otro_horario = Horario.objects.create(
            ciclo=ciclo, taller=taller, profesor=otro_profesor,
            dia_semana=1, hora_inicio='11:00', hora_fin='12:00', activo=True
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{otro_horario.id}/resumen-fecha/?fecha=2026-07-01'
        response = client.get(url)
        assert response.status_code == 404
        assert response.json()['detail'] == "Horario no encontrado"

    def test_inactive_ciclo_returns_404(self, ciclo, horario, profesor):
        ciclo.activo = False
        ciclo.save()
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha=2026-07-01'
        response = client.get(url)
        assert response.status_code == 404

    def test_pasado_returns_attendance_records(self, ciclo, horario, profesor, matricula, matricula_horario, alumno):
        fecha_pasada = date.today() - timedelta(days=5)
        Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=profesor,
            fecha=fecha_pasada,
            hora='10:00',
            estado='asistio',
            es_recuperacion=False,
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={fecha_pasada.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'pasado'
        assert data['aviso'] is None
        assert data['horario_id'] == horario.id
        assert data['taller_nombre'] == 'Guitarra'
        assert len(data['registros']) == 1
        registro = data['registros'][0]
        assert registro['alumno_id'] == alumno.id
        assert registro['nombre'] == alumno.nombre
        assert registro['apellido'] == alumno.apellido
        assert registro['dni'] == alumno.dni
        assert registro['estado_asistencia'] == 'asistio'
        assert registro['es_recuperacion'] is False
        assert registro['hora_asistencia'] == '10:00'
        assert registro['inscripcion_activa'] is True

    def test_pasado_includes_concluded_matricula_with_attendance(self, ciclo, horario, profesor, taller, alumno):
        matricula_concluida = Matricula.objects.create(
            ciclo=ciclo, alumno=alumno, taller=taller,
            sesiones_contratadas=8, precio_total=160, precio_por_sesion=20,
            activo=True, concluida=True, fecha_matricula='2026-01-01'
        )
        MatriculaHorario.objects.create(matricula=matricula_concluida, horario=horario)
        fecha_pasada = date.today() - timedelta(days=10)
        Asistencia.objects.create(
            matricula=matricula_concluida,
            horario=horario,
            profesor=profesor,
            fecha=fecha_pasada,
            hora='10:00',
            estado='falta',
            es_recuperacion=False,
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={fecha_pasada.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'pasado'
        assert len(data['registros']) == 1
        assert data['registros'][0]['estado_asistencia'] == 'falta'
        assert data['registros'][0]['inscripcion_activa'] is False

    def test_hoy_with_attendance_returns_attendance(self, ciclo, horario, profesor, matricula, matricula_horario, alumno):
        hoy = date.today()
        Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=profesor,
            fecha=hoy,
            hora='10:00',
            estado='asistio',
            es_recuperacion=True,
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={hoy.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'hoy'
        assert data['aviso'] is None
        assert len(data['registros']) == 1
        assert data['registros'][0]['estado_asistencia'] == 'asistio'
        assert data['registros'][0]['es_recuperacion'] is True

    def test_hoy_without_attendance_returns_enrollment_with_aviso(self, ciclo, horario, profesor, matricula_horario, alumno):
        hoy = date.today()
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={hoy.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'hoy'
        assert data['aviso'] == "Sin registros de asistencia aún"
        assert len(data['registros']) == 1
        assert data['registros'][0]['alumno_id'] == alumno.id
        assert data['registros'][0]['estado_asistencia'] is None
        assert data['registros'][0]['es_recuperacion'] is False
        assert data['registros'][0]['inscripcion_activa'] is True

    def test_futuro_returns_enrollment_with_disclaimer(self, ciclo, horario, profesor, matricula_horario, alumno):
        fecha_futura = date.today() + timedelta(days=5)
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={fecha_futura.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'futuro'
        assert data['aviso'] == "Inscripción sujeta a cambios"
        assert len(data['registros']) == 1
        assert data['registros'][0]['alumno_id'] == alumno.id
        assert data['registros'][0]['estado_asistencia'] is None

    def test_futuro_excludes_concluded_matriculas(self, ciclo, horario, profesor, taller, alumno):
        matricula_concluida = Matricula.objects.create(
            ciclo=ciclo, alumno=alumno, taller=taller,
            sesiones_contratadas=8, precio_total=160, precio_por_sesion=20,
            activo=True, concluida=True, fecha_matricula='2026-01-01'
        )
        MatriculaHorario.objects.create(matricula=matricula_concluida, horario=horario)
        fecha_futura = date.today() + timedelta(days=5)
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={fecha_futura.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'futuro'
        assert len(data['registros']) == 0

    def test_query_count_per_mode_is_low(self, ciclo, horario, profesor, matricula_horario):
        client = _portal_docente_client(profesor)

        for mode, fecha in [
            ('pasado', (date.today() - timedelta(days=5)).isoformat()),
            ('hoy', date.today().isoformat()),
            ('futuro', (date.today() + timedelta(days=5)).isoformat()),
        ]:
            url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={fecha}'
            with CaptureQueriesContext(connection) as ctx:
                response = client.get(url)
                assert response.status_code == 200
                # Ownership verification + main query = 2 data queries.
                # Token validation does not hit the DB for portal-docente JWTs.
                assert len(ctx) <= 3, f"Mode {mode} executed {len(ctx)} queries"

    def test_matricula_enrolled_after_date_not_in_past(self, ciclo, horario, profesor, taller, alumno):
        """A matrícula created after the requested past date must not appear as attendance."""
        matricula_futura = Matricula.objects.create(
            ciclo=ciclo, alumno=alumno, taller=taller,
            sesiones_contratadas=8, precio_total=160, precio_por_sesion=20,
            activo=True, concluida=False, fecha_matricula='2026-12-31'
        )
        MatriculaHorario.objects.create(matricula=matricula_futura, horario=horario)
        fecha_pasada = date.today() - timedelta(days=5)
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/horarios/{horario.id}/resumen-fecha/?fecha={fecha_pasada.isoformat()}'
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['modo'] == 'pasado'
        assert len(data['registros']) == 0
