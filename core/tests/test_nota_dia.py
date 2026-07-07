"""
Tests for NotaDia model and endpoints.
Covers: CRUD, unique constraint, authentication, and date filtering.
"""
import pytest
from datetime import date

from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import Ciclo, Profesor, NotaDia


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    """API client for testing."""
    return APIClient()


@pytest.fixture
def ciclo(db):
    """Create a test cycle."""
    return Ciclo.objects.create(
        nombre='2026-A',
        tipo='anual',
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
        activo=True
    )


@pytest.fixture
def profesor(db, ciclo):
    """Create an active test professor."""
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Carlos',
        apellido='López',
        dni='11223344',
        telefono='777777777',
        email='carlos@test.com',
        activo=True,
        es_gerente=False
    )


@pytest.fixture
def docente_token(profesor):
    """Get a portal-docente access token for the test professor."""
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor.id
    refresh['dni'] = profesor.dni
    refresh['type'] = 'portal_docente'
    return str(refresh.access_token)


@pytest.fixture
def authenticated_client(api_client, docente_token):
    """API client with valid portal-docente token."""
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {docente_token}')
    return api_client


# ---------------------------------------------------------------------------
# Tests: Model
# ---------------------------------------------------------------------------

class TestNotaDiaModel:
    """Tests for NotaDia model creation and constraints."""

    def test_create_nota_dia(self, db, ciclo, profesor):
        """A NotaDia can be created with valid fields."""
        nota = NotaDia.objects.create(
            ciclo=ciclo,
            profesor=profesor,
            fecha=date(2026, 6, 15),
            contenido='Feriado nacional'
        )
        assert nota.id is not None
        assert nota.contenido == 'Feriado nacional'
        assert nota.fecha == date(2026, 6, 15)
        assert nota.created_at is not None
        assert nota.updated_at is not None

    def test_unique_together_constraint(self, db, ciclo, profesor):
        """Cannot create two notas for the same ciclo+profesor+fecha."""
        NotaDia.objects.create(
            ciclo=ciclo,
            profesor=profesor,
            fecha=date(2026, 6, 15),
            contenido='Primera nota'
        )
        with pytest.raises(Exception):
            NotaDia.objects.create(
                ciclo=ciclo,
                profesor=profesor,
                fecha=date(2026, 6, 15),
                contenido='Segunda nota'
            )

    def test_str_representation(self, db, ciclo, profesor):
        """String representation includes profesor and fecha."""
        nota = NotaDia.objects.create(
            ciclo=ciclo,
            profesor=profesor,
            fecha=date(2026, 6, 15),
            contenido='Nota de prueba'
        )
        assert str(profesor) in str(nota)
        assert '2026-06-15' in str(nota)


# ---------------------------------------------------------------------------
# Tests: API Endpoints
# ---------------------------------------------------------------------------

class TestNotaDiaAPI:
    """Tests for NotaDia CRUD endpoints."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/notas-dia/'

    def test_post_creates_nota_dia(self, authenticated_client, ciclo, profesor):
        """POST creates a NotaDia and returns 201."""
        url = self.ENDPOINT.format(ciclo.id)
        response = authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Feriado nacional'
        }, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data['fecha'] == '2026-06-15'
        assert data['contenido'] == 'Feriado nacional'
        assert 'id' in data

    def test_post_duplicate_returns_400(self, authenticated_client, ciclo, profesor):
        """POST with same ciclo+profesor+fecha returns 400."""
        url = self.ENDPOINT.format(ciclo.id)
        # Create first
        authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Primera nota'
        }, format='json')
        # Try duplicate
        response = authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Segunda nota'
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Ya existe' in response.json()['detail']

    def test_get_filters_by_date(self, authenticated_client, ciclo, profesor):
        """GET with ?fecha= returns only notas for that date."""
        url = self.ENDPOINT.format(ciclo.id)
        # Create two notas on different dates
        authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Nota del lunes'
        }, format='json')
        authenticated_client.post(url, {
            'fecha': '2026-06-16',
            'contenido': 'Nota del martes'
        }, format='json')

        # Filter by first date
        response = authenticated_client.get(url + '?fecha=2026-06-15')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['contenido'] == 'Nota del lunes'

    def test_get_returns_all_without_date(self, authenticated_client, ciclo, profesor):
        """GET without fecha returns all notas for the profesor."""
        url = self.ENDPOINT.format(ciclo.id)
        authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Nota 1'
        }, format='json')
        authenticated_client.post(url, {
            'fecha': '2026-06-16',
            'contenido': 'Nota 2'
        }, format='json')

        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2

    def test_put_updates_nota(self, authenticated_client, ciclo, profesor):
        """PUT updates contenido and returns 200."""
        url = self.ENDPOINT.format(ciclo.id)
        # Create
        create_resp = authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Original'
        }, format='json')
        nota_id = create_resp.json()['id']

        # Update
        detail_url = f'{url}{nota_id}/'
        response = authenticated_client.put(detail_url, {
            'fecha': '2026-06-15',
            'contenido': 'Actualizado'
        }, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['contenido'] == 'Actualizado'

    def test_delete_removes_nota(self, authenticated_client, ciclo, profesor):
        """DELETE removes NotaDia and returns 200."""
        url = self.ENDPOINT.format(ciclo.id)
        create_resp = authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Para eliminar'
        }, format='json')
        nota_id = create_resp.json()['id']

        detail_url = f'{url}{nota_id}/'
        response = authenticated_client.delete(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['detail'] == 'Nota eliminada'

        # Verify it's gone
        get_resp = authenticated_client.get(detail_url)
        assert get_resp.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_returns_401(self, api_client, ciclo):
        """Request without JWT token returns 401."""
        url = self.ENDPOINT.format(ciclo.id)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_detail_get_returns_nota(self, authenticated_client, ciclo, profesor):
        """GET on detail endpoint returns the nota."""
        url = self.ENDPOINT.format(ciclo.id)
        create_resp = authenticated_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Detalle'
        }, format='json')
        nota_id = create_resp.json()['id']

        detail_url = f'{url}{nota_id}/'
        response = authenticated_client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['contenido'] == 'Detalle'

    def test_detail_404_for_wrong_profesor(self, api_client, ciclo, profesor, docente_token):
        """NotaDia from another profesor returns 404."""
        # Create nota as profesor
        url = self.ENDPOINT.format(ciclo.id)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {docente_token}')
        create_resp = api_client.post(url, {
            'fecha': '2026-06-15',
            'contenido': 'Secreta'
        }, format='json')
        nota_id = create_resp.json()['id']

        # Create another profesor and try to access
        otro_prof = Profesor.objects.create(
            ciclo=ciclo,
            nombre='Otro',
            apellido='Profesor',
            dni='99887766',
            activo=True,
            es_gerente=False
        )
        otro_refresh = RefreshToken()
        otro_refresh['profesor_id'] = otro_prof.id
        otro_refresh['dni'] = otro_prof.dni
        otro_refresh['type'] = 'portal_docente'
        otro_token = str(otro_refresh.access_token)

        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {otro_token}')
        detail_url = f'{url}{nota_id}/'
        response = api_client.get(detail_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND
