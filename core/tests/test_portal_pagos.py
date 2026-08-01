import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Egreso, Ciclo, Profesor
from core.shared.authentication import ProfesorJWTAuthentication


def _portal_docente_client(profesor):
    """Return an APIClient authenticated with a portal-docente JWT token."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor.id
    refresh['dni'] = profesor.dni
    refresh['type'] = 'portal_docente'
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


def _crear_ciclo(**kwargs):
    defaults = {'nombre': '2026', 'tipo': 'anual', 'fecha_inicio': '2026-01-01', 'fecha_fin': '2026-12-31', 'activo': True}
    defaults.update(kwargs)
    return Ciclo.objects.create(**defaults)


@pytest.mark.django_db
class TestProfesorPagosView:
    def test_returns_egresos_for_profesor(self):
        ciclo = _crear_ciclo()
        profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', activo=True
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=profesor, tipo='pago_profesor',
            monto=200, fecha='2026-07-15', metodo_pago='transferencia',
            estado='cancelado', descripcion='Pago julio'
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/pagos/'
        response = client.get(url)
        assert response.status_code == 200
        assert 'pagos' in response.data
        assert 'stats' in response.data
        assert len(response.data['pagos']) == 1
        assert response.data['stats']['total_pagado'] == 200

    def test_filters_by_fecha_desde(self):
        ciclo = _crear_ciclo()
        profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', activo=True
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=profesor, tipo='pago_profesor',
            monto=100, fecha='2026-06-01', metodo_pago='efectivo',
            estado='cancelado'
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=profesor, tipo='pago_profesor',
            monto=200, fecha='2026-07-15', metodo_pago='transferencia',
            estado='cancelado'
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/pagos/?fecha_desde=2026-07-01'
        response = client.get(url)
        assert response.status_code == 200
        assert len(response.data['pagos']) == 1
        assert float(response.data['pagos'][0]['monto']) == 200

    def test_excludes_other_profesor(self):
        ciclo = _crear_ciclo()
        profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', activo=True
        )
        otro = Profesor.objects.create(
            ciclo=ciclo, nombre='María', apellido='López',
            dni='87654321', activo=True
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=otro, tipo='pago_profesor',
            monto=300, fecha='2026-07-15', metodo_pago='yape',
            estado='cancelado'
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/pagos/'
        response = client.get(url)
        assert response.status_code == 200
        assert len(response.data['pagos']) == 0
