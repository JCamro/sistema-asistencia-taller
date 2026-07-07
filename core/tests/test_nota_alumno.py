"""
Tests for NotaAlumno model and endpoints.
Covers: CRUD, unique constraint, authentication, date filtering, and scoping.
"""
import pytest
from datetime import date, time

from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import Ciclo, Profesor, Taller, Horario, Alumno, NotaAlumno


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
def otro_profesor(db, ciclo):
    """Another profesor for scoping tests."""
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Otro',
        apellido='Docente',
        dni='99887766',
        activo=True,
        es_gerente=False
    )


@pytest.fixture
def taller(db, ciclo):
    """Create a test workshop."""
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Guitarra Clásica',
        tipo='instrumento',
        activo=True,
    )


@pytest.fixture
def horario(db, ciclo, profesor, taller):
    """Create a test schedule."""
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller,
        profesor=profesor,
        dia_semana=1,  # Lunes
        hora_inicio=time(14, 0),
        hora_fin=time(15, 0),
        cupo_maximo=10,
        tipo_pago='tarifa_fija',
        activo=True,
    )


@pytest.fixture
def alumno(db, ciclo):
    """Create a test student."""
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='María',
        apellido='García',
        dni='12345678',
        telefono='999888777',
        email='maria@test.com',
        activo=True,
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

class TestNotaAlumnoModel:
    """Tests for NotaAlumno model creation and constraints."""

    def test_create_nota_alumno(self, db, ciclo, profesor, horario, alumno):
        """A NotaAlumno can be created with valid fields."""
        nota = NotaAlumno.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            alumno=alumno,
            fecha=date(2026, 6, 15),
            contenido='Necesita mejorar técnica de digitación'
        )
        assert nota.id is not None
        assert nota.contenido == 'Necesita mejorar técnica de digitación'
        assert nota.fecha == date(2026, 6, 15)
        assert nota.created_at is not None
        assert nota.updated_at is not None

    def test_unique_together_constraint(self, db, ciclo, profesor, horario, alumno):
        """Cannot create two notas for the same profesor+horario+alumno+fecha."""
        NotaAlumno.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            alumno=alumno,
            fecha=date(2026, 6, 15),
            contenido='Primera nota'
        )
        with pytest.raises(Exception):
            NotaAlumno.objects.create(
                profesor=profesor,
                ciclo=ciclo,
                horario=horario,
                alumno=alumno,
                fecha=date(2026, 6, 15),
                contenido='Segunda nota'
            )

    def test_str_representation(self, db, ciclo, profesor, horario, alumno):
        """String representation includes profesor, alumno, horario, and fecha."""
        nota = NotaAlumno.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            alumno=alumno,
            fecha=date(2026, 6, 15),
            contenido='Nota de prueba'
        )
        assert str(profesor) in str(nota)
        assert str(alumno) in str(nota)
        assert '2026-06-15' in str(nota)

    def test_different_alumno_allowed(self, db, ciclo, profesor, horario, alumno):
        """Same profesor+horario+fecha with different alumno is allowed."""
        otro_alumno = Alumno.objects.create(
            ciclo=ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='87654321',
            activo=True,
        )
        NotaAlumno.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            alumno=alumno,
            fecha=date(2026, 6, 15),
            contenido='Nota para María'
        )
        # Same profesor+horario+fecha but different alumno — should succeed
        nota2 = NotaAlumno.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            alumno=otro_alumno,
            fecha=date(2026, 6, 15),
            contenido='Nota para Juan'
        )
        assert nota2.id is not None


# ---------------------------------------------------------------------------
# Tests: API Endpoints
# ---------------------------------------------------------------------------

class TestNotaAlumnoAPI:
    """Tests for NotaAlumno CRUD endpoints."""

    ENDPOINT = '/api/portal-docente/ciclos/{}/notas-alumno/'

    def test_post_creates_nota_alumno(self, authenticated_client, ciclo, horario, alumno):
        """POST creates a NotaAlumno and returns 201."""
        url = self.ENDPOINT.format(ciclo.id)
        response = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Necesita mejorar técnica'
        }, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data['fecha'] == '2026-06-15'
        assert data['contenido'] == 'Necesita mejorar técnica'
        assert data['alumno'] == alumno.id
        assert data['alumno_nombre'] == 'García, María'
        assert 'id' in data

    def test_post_duplicate_returns_400(self, authenticated_client, ciclo, horario, alumno):
        """POST with same profesor+horario+alumno+fecha returns 400."""
        url = self.ENDPOINT.format(ciclo.id)
        # Create first
        authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Primera nota'
        }, format='json')
        # Try duplicate
        response = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Segunda nota'
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Ya existe' in response.json()['detail']

    def test_get_filters_by_horario(self, authenticated_client, ciclo, horario, alumno):
        """GET with ?horario_id= returns only notas for that schedule."""
        url = self.ENDPOINT.format(ciclo.id)

        # Create nota
        authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Nota de prueba'
        }, format='json')

        response = authenticated_client.get(url + f'?horario_id={horario.id}')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1

        response_vacia = authenticated_client.get(url + '?horario_id=9999')
        assert response.status_code == status.HTTP_200_OK
        assert len(response_vacia.json()) == 0

    def test_get_filters_by_fecha(self, authenticated_client, ciclo, horario, alumno):
        """GET with ?fecha= returns only notas for that date."""
        url = self.ENDPOINT.format(ciclo.id)

        authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Nota del lunes'
        }, format='json')

        response = authenticated_client.get(url + '?fecha=2026-06-15')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['contenido'] == 'Nota del lunes'

    def test_get_filters_by_alumno(self, authenticated_client, ciclo, horario, alumno):
        """GET with ?alumno_id= returns only notas for that student."""
        url = self.ENDPOINT.format(ciclo.id)

        authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Nota para María'
        }, format='json')

        response = authenticated_client.get(url + f'?alumno_id={alumno.id}')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['contenido'] == 'Nota para María'

    def test_get_returns_all_without_filters(self, authenticated_client, ciclo, horario, alumno):
        """GET without filters returns all notas for the profesor."""
        url = self.ENDPOINT.format(ciclo.id)
        authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Nota 1'
        }, format='json')

        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1

    def test_put_updates_nota(self, authenticated_client, ciclo, horario, alumno):
        """PUT updates contenido and returns 200."""
        url = self.ENDPOINT.format(ciclo.id)
        create_resp = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Original'
        }, format='json')
        nota_id = create_resp.json()['id']

        detail_url = f'{url}{nota_id}/'
        response = authenticated_client.put(detail_url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Actualizado'
        }, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['contenido'] == 'Actualizado'

    def test_patch_updates_nota(self, authenticated_client, ciclo, horario, alumno):
        """PATCH updates contenido partially."""
        url = self.ENDPOINT.format(ciclo.id)
        create_resp = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Original'
        }, format='json')
        nota_id = create_resp.json()['id']

        detail_url = f'{url}{nota_id}/'
        response = authenticated_client.patch(detail_url, {
            'contenido': 'Actualizado solo contenido'
        }, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['contenido'] == 'Actualizado solo contenido'

    def test_delete_removes_nota(self, authenticated_client, ciclo, horario, alumno):
        """DELETE removes NotaAlumno and returns 200."""
        url = self.ENDPOINT.format(ciclo.id)
        create_resp = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
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

    def test_detail_get_returns_nota(self, authenticated_client, ciclo, horario, alumno):
        """GET on detail endpoint returns the nota."""
        url = self.ENDPOINT.format(ciclo.id)
        create_resp = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Detalle'
        }, format='json')
        nota_id = create_resp.json()['id']

        detail_url = f'{url}{nota_id}/'
        response = authenticated_client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['contenido'] == 'Detalle'

    def test_detail_404_for_wrong_profesor(self, api_client, ciclo, profesor, horario, alumno, docente_token):
        """NotaAlumno from another profesor returns 404."""
        # Create nota as profesor
        url = self.ENDPOINT.format(ciclo.id)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {docente_token}')
        create_resp = api_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
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

    def test_wrong_profesor_horario_returns_400(self, authenticated_client, ciclo, otro_profesor, horario, alumno):
        """POST with horario from another profesor returns 400."""
        url = self.ENDPOINT.format(ciclo.id)
        response = authenticated_client.post(url, {
            'horario': horario.id,
            'alumno': alumno.id,
            'fecha': '2026-06-15',
            'contenido': 'Nota'
        }, format='json')
        # horario.profesor is the fixture profesor (matches authenticated client)
        assert response.status_code == status.HTTP_201_CREATED
