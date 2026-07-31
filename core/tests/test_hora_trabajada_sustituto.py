import pytest
from datetime import date

from rest_framework.test import APIClient

from core.models import Ciclo, Profesor, Taller, Horario
from core.models.hora_trabajada import HoraTrabajada
from core.serializers.hora_trabajada import (
    HoraTrabajadaListSerializer,
    HoraTrabajadaDetailSerializer,
)
from core.services.hora_trabajada_service import HoraTrabajadaService


FECHA_PASADA = date(2026, 1, 15)
FECHA_PASADA_2 = date(2026, 1, 16)


@pytest.fixture
def otro_profesor(ciclo):
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Jorge',
        apellido='López',
        dni='22222222',
        activo=True,
    )


@pytest.fixture
def hora_titular(ciclo, profesor, horario):
    return HoraTrabajada.objects.create(
        profesor=profesor,
        ciclo=ciclo,
        horario=horario,
        fecha=FECHA_PASADA,
        tipo='clase_regular',
        horas_trabajadas=1,
        monto_profesor=17.00,
        estado='aprobada',
        created_from='admin_manual',
    )


@pytest.fixture
def hora_sustituto(ciclo, profesor, horario, otro_profesor):
    return HoraTrabajada.objects.create(
        profesor=otro_profesor,
        ciclo=ciclo,
        horario=horario,
        fecha=FECHA_PASADA_2,
        tipo='clase_regular',
        horas_trabajadas=1,
        monto_profesor=20.00,
        estado='aprobada',
        created_from='admin_manual',
    )


@pytest.mark.django_db
class TestHoraTrabajadaSerializerSustituto:
    def test_es_sustituto_false_for_titular(self, hora_titular):
        serializer = HoraTrabajadaListSerializer(hora_titular)
        data = serializer.data
        assert data['es_sustituto'] is False
        assert data['horario_profesor_id'] == hora_titular.profesor_id
        assert data['horario_profesor_nombre'] == 'Pérez, Juan'

    def test_es_sustituto_true_for_sustituto(self, hora_sustituto):
        serializer = HoraTrabajadaListSerializer(hora_sustituto)
        data = serializer.data
        assert data['es_sustituto'] is True
        assert data['horario_profesor_id'] != hora_sustituto.profesor_id
        assert data['horario_profesor_nombre'] == 'Pérez, Juan'

    def test_detail_includes_sustituto_fields(self, hora_sustituto):
        serializer = HoraTrabajadaDetailSerializer(hora_sustituto)
        data = serializer.data
        assert data['es_sustituto'] is True
        assert data['horario_profesor_id'] == hora_sustituto.horario.profesor_id
        assert data['horario_profesor_nombre'] == 'Pérez, Juan'

    def test_sustituto_fields_when_no_horario(self, ciclo, otro_profesor):
        ht = HoraTrabajada.objects.create(
            profesor=otro_profesor,
            ciclo=ciclo,
            horario=None,
            fecha=FECHA_PASADA,
            tipo='hora_extra',
            horas_trabajadas=2,
            monto_profesor=30.00,
            estado='aprobada',
        )
        serializer = HoraTrabajadaListSerializer(ht)
        data = serializer.data
        assert data['es_sustituto'] is False
        assert data['horario_profesor_id'] is None
        assert data['horario_profesor_nombre'] is None


@pytest.mark.django_db
class TestHoraTrabajadaCrearManualSustituto:
    def test_crear_manual_allows_profesor_different_from_horario(self, ciclo, horario, otro_profesor):
        ht = HoraTrabajadaService.crear_manual({
            'profesor': otro_profesor,
            'ciclo': ciclo,
            'horario': horario,
            'fecha': FECHA_PASADA,
            'horas_trabajadas': 1,
            'monto_profesor': 18.00,
            'observacion': '',
        })
        assert ht.profesor_id == otro_profesor.id
        assert ht.horario.profesor_id == horario.profesor_id


@pytest.mark.django_db
class TestHoraTrabajadaReassign:
    def test_reassign_updates_profesor(self, cliente_autenticado, hora_titular, otro_profesor):
        url = f'/api/horas-trabajadas/{hora_titular.id}/reassign/'
        response = cliente_autenticado.patch(url, {'profesor': otro_profesor.id}, format='json')
        assert response.status_code == 200
        data = response.json()
        assert data['profesor'] == otro_profesor.id
        assert data['es_sustituto'] is True

        hora_titular.refresh_from_db()
        assert hora_titular.profesor_id == otro_profesor.id

    def test_reassign_returns_409_on_duplicate(self, cliente_autenticado, ciclo, horario, profesor, otro_profesor):
        # Registro existente del otro profesor en la misma fecha/horario
        HoraTrabajada.objects.create(
            profesor=otro_profesor,
            ciclo=ciclo,
            horario=horario,
            fecha=FECHA_PASADA,
            tipo='clase_regular',
            horas_trabajadas=1,
            monto_profesor=20.00,
            estado='aprobada',
            created_from='admin_manual',
        )
        hora_titular = HoraTrabajada.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            fecha=FECHA_PASADA,
            tipo='clase_regular',
            horas_trabajadas=1,
            monto_profesor=17.00,
            estado='aprobada',
            created_from='admin_manual',
        )
        url = f'/api/horas-trabajadas/{hora_titular.id}/reassign/'
        response = cliente_autenticado.patch(url, {'profesor': otro_profesor.id}, format='json')
        assert response.status_code == 409
        assert 'Ya existe' in response.json()['detail']

    def test_reassign_returns_400_for_inactive_profesor(self, cliente_autenticado, hora_titular, ciclo):
        inactive = Profesor.objects.create(
            ciclo=ciclo,
            nombre='Inactivo',
            apellido='Profe',
            dni='33333333',
            activo=False,
        )
        url = f'/api/horas-trabajadas/{hora_titular.id}/reassign/'
        response = cliente_autenticado.patch(url, {'profesor': inactive.id}, format='json')
        assert response.status_code == 400
        assert 'inactivo' in response.json()['detail'].lower()

    def test_reassign_returns_401_without_auth(self, hora_titular, otro_profesor):
        client = APIClient()
        url = f'/api/horas-trabajadas/{hora_titular.id}/reassign/'
        response = client.patch(url, {'profesor': otro_profesor.id}, format='json')
        assert response.status_code == 401
