import pytest
from django.db import IntegrityError
from django.urls import reverse
from datetime import date, time

from core.models import Ciclo, Taller, Profesor, Alumno, Horario, Matricula, MatriculaHorario, Asistencia, Feriado


@pytest.mark.django_db
class TestFeriadoModel:
    def test_global_feriado_unique_per_ciclo_fecha(self, ciclo):
        Feriado.objects.create(ciclo=ciclo, fecha='2026-07-28', motivo='Fiestas Patrias')

        with pytest.raises(IntegrityError):
            Feriado.objects.create(ciclo=ciclo, fecha='2026-07-28', motivo='Otro feriado')

    def test_scoped_feriado_unique_per_scope(self, ciclo, taller, horario):
        Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Por taller',
            taller=taller, horario=None
        )

        with pytest.raises(IntegrityError):
            Feriado.objects.create(
                ciclo=ciclo, fecha='2026-07-28', motivo='Por taller duplicado',
                taller=taller, horario=None
            )

    def test_global_and_scoped_feriado_can_coexist(self, ciclo, taller):
        Feriado.objects.create(ciclo=ciclo, fecha='2026-07-28', motivo='Global')
        Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Por taller',
            taller=taller, horario=None
        )


@pytest.mark.django_db
class TestFeriadoAplicar:
    def test_aplicar_crea_faltas_pendientes(self, cliente_autenticado, ciclo, horario, matricula, matricula_horario):
        feriado = Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Día no laborable'
        )

        url = reverse('ciclo-feriados-aplicar', kwargs={
            'ciclo_id': ciclo.id,
            'pk': feriado.id
        })
        response = cliente_autenticado.post(url)

        assert response.status_code == 200
        assert response.json()['creadas'] == 1

        asistencia = Asistencia.objects.first()
        assert asistencia is not None
        assert asistencia.estado == 'falta'
        assert asistencia.es_recuperacion is False
        assert asistencia.matricula == matricula
        assert asistencia.horario == horario

    def test_aplicar_ignora_asistencias_ya_marcadas(self, cliente_autenticado, ciclo, horario, profesor, matricula, matricula_horario):
        Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=profesor,
            fecha='2026-07-28',
            hora=time(10, 0),
            estado='asistio',
            es_recuperacion=False
        )

        feriado = Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Día no laborable'
        )

        url = reverse('ciclo-feriados-aplicar', kwargs={
            'ciclo_id': ciclo.id,
            'pk': feriado.id
        })
        response = cliente_autenticado.post(url)

        assert response.status_code == 200
        assert response.json()['creadas'] == 0
        assert Asistencia.objects.count() == 1

    def test_aplicar_ignora_recuperaciones(self, cliente_autenticado, ciclo, horario, profesor, matricula):
        Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=profesor,
            fecha='2026-07-28',
            hora=time(10, 0),
            estado='asistio',
            es_recuperacion=True
        )

        feriado = Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Día no laborable'
        )

        url = reverse('ciclo-feriados-aplicar', kwargs={
            'ciclo_id': ciclo.id,
            'pk': feriado.id
        })
        response = cliente_autenticado.post(url)

        assert response.status_code == 200
        assert response.json()['creadas'] == 0

    def test_aplicar_scoped_a_taller(self, cliente_autenticado, ciclo, taller, horario, matricula, matricula_horario):
        otro_taller = Taller.objects.create(
            ciclo=ciclo, nombre='Piano', tipo='instrumento', activo=True
        )
        otro_profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Luis', apellido='Torres', dni='11111111', activo=True
        )
        otro_horario = Horario.objects.create(
            ciclo=ciclo, taller=otro_taller, profesor=otro_profesor,
            dia_semana=1, hora_inicio='10:00', hora_fin='11:00'
        )
        MatriculaHorario.objects.create(matricula=matricula, horario=otro_horario)

        feriado = Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Cierre por taller',
            taller=taller, horario=None
        )

        url = reverse('ciclo-feriados-aplicar', kwargs={
            'ciclo_id': ciclo.id,
            'pk': feriado.id
        })
        response = cliente_autenticado.post(url)

        assert response.status_code == 200
        assert response.json()['creadas'] == 1
        assert Asistencia.objects.filter(horario=horario).exists()
        assert not Asistencia.objects.filter(horario=otro_horario).exists()


@pytest.mark.django_db
class TestPorHorarioFeriado:
    def test_por_horario_detecta_feriado_global(self, cliente_autenticado, ciclo, horario, matricula, matricula_horario):
        Feriado.objects.create(ciclo=ciclo, fecha='2026-07-28', motivo='Global')

        url = reverse('ciclo-asistencias-por-horario', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url, {
            'horario_id': horario.id,
            'fecha': '2026-07-28'
        })

        data = response.json()
        assert response.status_code == 200
        assert data['es_feriado'] is True
        assert data['motivo'] == 'Global'
        assert len(data['resultados']) == 1

    def test_por_horario_detecta_feriado_por_taller(self, cliente_autenticado, ciclo, taller, horario, matricula, matricula_horario):
        Feriado.objects.create(
            ciclo=ciclo, fecha='2026-07-28', motivo='Por taller',
            taller=taller
        )

        url = reverse('ciclo-asistencias-por-horario', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url, {
            'horario_id': horario.id,
            'fecha': '2026-07-28'
        })

        data = response.json()
        assert response.status_code == 200
        assert data['es_feriado'] is True

    def test_por_horario_sin_feriado(self, cliente_autenticado, ciclo, horario, matricula, matricula_horario):
        url = reverse('ciclo-asistencias-por-horario', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url, {
            'horario_id': horario.id,
            'fecha': '2026-07-28'
        })

        data = response.json()
        assert response.status_code == 200
        assert data['es_feriado'] is False
        assert data['motivo'] is None
