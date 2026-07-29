import pytest
from datetime import date, timedelta
from django.urls import reverse

from core.models import Nota


@pytest.mark.django_db
class TestNotaModel:
    def test_crea_nota_simple(self, ciclo):
        nota = Nota.objects.create(ciclo=ciclo, titulo='Recordar pago', contenido='Pendiente')
        assert nota.titulo == 'Recordar pago'
        assert nota.leida is False
        assert nota.es_recordatorio is False

    def test_recordatorio_con_vencimiento(self, ciclo):
        nota = Nota.objects.create(
            ciclo=ciclo, titulo='Vencer', es_recordatorio=True,
            fecha_vencimiento=date.today() + timedelta(days=2)
        )
        assert nota.es_recordatorio is True
        assert nota.fecha_vencimiento is not None

    def test_ordenamiento_por_fecha(self, ciclo):
        Nota.objects.create(ciclo=ciclo, titulo='Ayer', fecha=date.today() - timedelta(days=1))
        Nota.objects.create(ciclo=ciclo, titulo='Hoy', fecha=date.today())
        notas = list(Nota.objects.filter(ciclo=ciclo))
        assert notas[0].titulo == 'Hoy'
        assert notas[1].titulo == 'Ayer'


@pytest.mark.django_db
class TestNotaApi:
    def test_listar_notas_por_ciclo(self, cliente_autenticado, ciclo):
        Nota.objects.create(ciclo=ciclo, titulo='N1')
        url = reverse('ciclo-notas', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)
        assert response.status_code == 200
        assert len(response.json()['results']) == 1

    def test_no_leidas_excluye_leidas(self, cliente_autenticado, ciclo):
        Nota.objects.create(ciclo=ciclo, titulo='Sin leer', es_recordatorio=True)
        Nota.objects.create(ciclo=ciclo, titulo='Leída', leida=True, es_recordatorio=True)
        url = reverse('ciclo-notas-no-leidas', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['count'] == 1
        assert len(data['results']) == 1
        assert data['results'][0]['titulo'] == 'Sin leer'

    def test_marcar_leida(self, cliente_autenticado, ciclo):
        nota = Nota.objects.create(ciclo=ciclo, titulo='Revisar')
        url = reverse('notas-marcar-leida', kwargs={'pk': nota.id})
        response = cliente_autenticado.patch(url)
        assert response.status_code == 200
        assert response.json()['leida'] is True
        nota.refresh_from_db()
        assert nota.leida is True

    def test_crear_nota_en_ciclo(self, cliente_autenticado, ciclo):
        url = reverse('ciclo-notas', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.post(url, {
            'titulo': 'Nueva',
            'contenido': 'Contenido',
            'fecha': '2026-07-30',
        }, format='json')
        assert response.status_code == 201
        assert response.json()['ciclo'] == ciclo.id
        assert Nota.objects.filter(ciclo=ciclo, titulo='Nueva').exists()
