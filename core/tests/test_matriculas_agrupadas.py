import pytest
from django.urls import reverse
from datetime import date

from core.models import Recibo, ReciboMatricula


@pytest.mark.django_db
class TestMatriculasAgrupadas:
    def test_agrupadas_agrupa_por_alumno(self, cliente_autenticado, ciclo, alumno, taller, matricula):
        url = reverse('ciclo-matriculas-agrupadas', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)

        data = response.json()
        assert response.status_code == 200
        assert len(data) == 1
        assert data[0]['alumno_id'] == alumno.id
        assert data[0]['alumno_nombre'] == f"{alumno.apellido}, {alumno.nombre}"
        assert len(data[0]['matriculas']) == 1
        assert data[0]['matriculas'][0]['id'] == matricula.id

    def test_agrupadas_conteos_por_estado(self, cliente_autenticado, ciclo, alumno, taller, matricula):
        url = reverse('ciclo-matriculas-agrupadas', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)

        data = response.json()
        assert response.status_code == 200
        assert data[0]['sin_procesar'] == 1
        assert data[0]['activas'] == 0
        assert data[0]['concluidas'] == 0
        assert data[0]['inactivas'] == 0

    def test_agrupadas_recibo_estado_pagado(self, cliente_autenticado, ciclo, alumno, matricula):
        recibo = Recibo.objects.create(
            ciclo=ciclo,
            numero='R-001',
            fecha_emision=date(2026, 7, 1),
            monto_total=160,
            estado='pagado'
        )
        ReciboMatricula.objects.create(recibo=recibo, matricula=matricula, monto=160)

        url = reverse('ciclo-matriculas-agrupadas', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)

        data = response.json()
        assert response.status_code == 200
        assert data[0]['matriculas'][0]['recibo_estado'] == 'pagado'
        assert data[0]['matriculas'][0]['estado'] == 'activa'


@pytest.mark.django_db
class TestMatriculaDetalle:
    def test_matricula_detalle_incluye_horarios_y_asistencias(
        self, cliente_autenticado, ciclo, matricula, matricula_horario, horario
    ):
        url = reverse('ciclo-matricula-detalle', kwargs={
            'ciclo_id': ciclo.id,
            'pk': matricula.id
        })
        response = cliente_autenticado.get(url)

        data = response.json()
        assert response.status_code == 200
        assert data['matricula']['id'] == matricula.id
        assert len(data['matricula']['horarios']) == 1
        assert data['matricula']['horarios'][0]['id'] == horario.id
        assert data['matricula']['recibo'] is None
        assert data['matricula']['recibo_estado'] == 'sin_recibo'

    def test_matricula_detalle_incluye_recibo(self, cliente_autenticado, ciclo, matricula, recibo):
        ReciboMatricula.objects.create(recibo=recibo, matricula=matricula, monto=160)

        url = reverse('ciclo-matricula-detalle', kwargs={
            'ciclo_id': ciclo.id,
            'pk': matricula.id
        })
        response = cliente_autenticado.get(url)

        data = response.json()
        assert response.status_code == 200
        assert data['matricula']['recibo'] is not None
        assert data['matricula']['recibo']['numero'] == 'R-001'


@pytest.mark.django_db
class TestAlumnoDetalle:
    def test_alumno_detalle_incluye_matriculas_y_asistencias(
        self, cliente_autenticado, ciclo, alumno, matricula, matricula_horario, horario, profesor
    ):
        from core.models import Asistencia
        from datetime import time
        Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=profesor,
            fecha='2026-07-15',
            hora=time(10, 0),
            estado='asistio',
            es_recuperacion=False
        )

        url = reverse('ciclo-alumno-detalle', kwargs={
            'ciclo_id': ciclo.id,
            'pk': alumno.id
        })
        response = cliente_autenticado.get(url)

        data = response.json()
        assert response.status_code == 200
        assert data['alumno']['id'] == alumno.id
        assert len(data['matriculas']) == 1
        assert len(data['matriculas'][0]['asistencias']) == 1


@pytest.fixture
def recibo(ciclo):
    return Recibo.objects.create(
        ciclo=ciclo,
        numero='R-001',
        fecha_emision=date(2026, 7, 1),
        monto_total=160,
        estado='pagado'
    )
