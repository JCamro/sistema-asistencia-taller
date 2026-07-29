import pytest
from django.urls import reverse

from core.models import Ciclo, Taller, Alumno, Matricula
from core.models.precio_paquete import PrecioPaquete


@pytest.mark.django_db
class TestPricingViews:
    @pytest.fixture(autouse=True)
    def setup_prices(self, ciclo):
        PrecioPaquete.objects.create(
            ciclo=ciclo,
            tipo_taller='instrumento',
            tipo_paquete='individual',
            cantidad_clases=12,
            cantidad_clases_secundaria=None,
            precio_total=220.00,
            precio_por_sesion=18.33,
            activo=True,
        )
        PrecioPaquete.objects.create(
            ciclo=None,
            tipo_taller='instrumento',
            tipo_paquete='individual',
            cantidad_clases=1,
            cantidad_clases_secundaria=None,
            precio_total=20.00,
            precio_por_sesion=20.00,
            activo=True,
        )
        PrecioPaquete.objects.create(
            ciclo=None,
            tipo_taller='instrumento',
            tipo_paquete='combo_musical',
            cantidad_clases=12,
            cantidad_clases_secundaria=12,
            precio_total=400.00,
            precio_por_sesion=16.67,
            activo=True,
        )

    @pytest.fixture
    def instrumento_doce(self, ciclo, alumno):
        taller = Taller.objects.create(
            ciclo=ciclo,
            nombre='Piano',
            tipo='instrumento',
            activo=True
        )
        return Matricula.objects.create(
            ciclo=ciclo,
            alumno=alumno,
            taller=taller,
            sesiones_contratadas=12,
            precio_total=240.00,
            precio_por_sesion=20.00,
            activo=True,
            concluida=False
        )

    @pytest.fixture
    def otro_instrumento_doce(self, ciclo):
        otro_alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Carlos',
            apellido='Lopez',
            dni='11111111',
            activo=True
        )
        taller = Taller.objects.create(
            ciclo=ciclo,
            nombre='Batería',
            tipo='instrumento',
            activo=True
        )
        return Matricula.objects.create(
            ciclo=ciclo,
            alumno=otro_alumno,
            taller=taller,
            sesiones_contratadas=12,
            precio_total=240.00,
            precio_por_sesion=20.00,
            activo=True,
            concluida=False
        )

    def test_preview_valid(self, cliente_autenticado, instrumento_doce, otro_instrumento_doce):
        url = reverse('pricing-preview')
        response = cliente_autenticado.post(url, {
            'matricula_ids': [instrumento_doce.id, otro_instrumento_doce.id]
        }, format='json')

        assert response.status_code == 200
        data = response.json()
        assert 'items' in data
        assert len(data['items']) == 2
        assert data['paquete_aplicado'] == 'combo_musical_12_12'
        assert data['total_general'] == 400.00
        assert data['descuento_total'] == 40.00

    def test_preview_empty(self, cliente_autenticado):
        url = reverse('pricing-preview')
        response = cliente_autenticado.post(url, {
            'matricula_ids': []
        }, format='json')

        assert response.status_code == 400

    def test_preview_not_found(self, cliente_autenticado):
        url = reverse('pricing-preview')
        response = cliente_autenticado.post(url, {
            'matricula_ids': [99999]
        }, format='json')

        assert response.status_code == 404

    def test_preview_different_ciclos(self, cliente_autenticado, matricula):
        otro_ciclo = Ciclo.objects.create(
            nombre='Otro Ciclo',
            tipo='anual',
            fecha_inicio='2026-01-01',
            fecha_fin='2026-12-31'
        )
        otro_alumno = Alumno.objects.create(
            ciclo=otro_ciclo,
            nombre='Carlos',
            apellido='Lopez',
            dni='11111111',
            activo=True
        )
        otro_taller = Taller.objects.create(
            ciclo=otro_ciclo,
            nombre='Batería',
            tipo='instrumento',
            activo=True
        )
        otra_matricula = Matricula.objects.create(
            ciclo=otro_ciclo,
            alumno=otro_alumno,
            taller=otro_taller,
            sesiones_contratadas=12,
            precio_total=240.00,
            precio_por_sesion=20.00,
            activo=True,
            concluida=False
        )

        url = reverse('pricing-preview')
        response = cliente_autenticado.post(url, {
            'matricula_ids': [matricula.id, otra_matricula.id]
        }, format='json')

        assert response.status_code == 400

    def test_calculate_valid(self, cliente_autenticado, instrumento_doce, otro_instrumento_doce):
        url = reverse('pricing-calculate')
        response = cliente_autenticado.post(url, {
            'matricula_ids': [instrumento_doce.id, otro_instrumento_doce.id]
        }, format='json')

        assert response.status_code == 200
        data = response.json()
        assert 'total_final' in data
        assert 'items' in data
        assert data['paquete_aplicado'] == 'combo_musical_12_12'
        assert data['total_final'] == 400.00

    def test_individual_with_cycle_price(self, cliente_autenticado, ciclo):
        url = reverse('pricing-individual')
        response = cliente_autenticado.get(url, {
            'tipo_taller': 'instrumento',
            'sesiones': 12,
            'ciclo_id': ciclo.id
        })

        assert response.status_code == 200
        data = response.json()
        assert data['precio_total'] == 220.00

    def test_individual_without_cycle_price(self, cliente_autenticado):
        url = reverse('pricing-individual')
        response = cliente_autenticado.get(url, {
            'tipo_taller': 'instrumento',
            'sesiones': 12
        })

        assert response.status_code == 200
        data = response.json()
        assert data['precio_total'] == 240.00

    def test_individual_missing_params(self, cliente_autenticado):
        url = reverse('pricing-individual')
        response = cliente_autenticado.get(url, {'tipo_taller': 'instrumento'})

        assert response.status_code == 400
