"""
Tests for portal authentication endpoints.
Covers: login success, login failure, rate limiting, logout.
"""
import pytest
from datetime import date

from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework import status

from core.models import Alumno, Ciclo


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
def alumno(db, ciclo):
    """Create a test student."""
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='Test',
        apellido='Student',
        dni='12345678',
        telefono='999999999',
        email='test@test.com',
        fecha_nacimiento=date(2010, 1, 1),
        activo=True
    )


@pytest.fixture
def another_alumno(db, ciclo):
    """Create another test student."""
    return Alumno.objects.create(
        ciclo=ciclo,
        nombre='Another',
        apellido='Student',
        dni='87654321',
        telefono='888888888',
        email='another@test.com',
        fecha_nacimiento=date(2012, 6, 15),
        activo=True
    )


@pytest.fixture
def portal_token(alumno):
    """Get a portal access token for the test student."""
    from rest_framework_simplejwt.tokens import RefreshToken
    
    refresh = RefreshToken()
    refresh['alumno_id'] = alumno.id
    refresh['dni'] = alumno.dni
    refresh['type'] = 'portal'
    
    return str(refresh.access_token)


@pytest.fixture
def authenticated_client(api_client, portal_token):
    """API client with valid portal token."""
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {portal_token}')
    return api_client


class TestPortalLogin:
    """Tests for POST /api/portal/auth/login/"""
    
    def test_login_success(self, api_client, alumno, ciclo):
        """Login with valid DNI returns tokens and user data."""
        response = api_client.post('/api/portal/auth/login/', {
            'dni': '12345678'
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert 'user' in response.data
        assert 'ciclos' in response.data
        
        # Check user data (should NOT include sensitive fields)
        assert response.data['user']['id'] == alumno.id
        assert response.data['user']['nombre'] == 'Test'
        assert response.data['user']['apellido'] == 'Student'
        assert 'dni' not in response.data['user']
        assert 'email' not in response.data['user']
        assert 'telefono' not in response.data['user']
        
        # ciclos is returned but may be empty if student has no enrollments
        assert isinstance(response.data['ciclos'], list)
    
    def test_login_invalid_dni(self, api_client, db):
        """Login with non-existent DNI returns 404 with delay."""
        import time
        
        # Time the request to verify delay
        start = time.time()
        response = api_client.post('/api/portal/auth/login/', {
            'dni': '00000000'
        })
        elapsed = time.time() - start
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['detail'] == 'Credenciales inválidas'
        # Should have approximately 2 second delay
        assert elapsed >= 1.8  # Allow some margin
    
    def test_login_missing_dni(self, api_client, db):
        """Login without DNI returns validation error."""
        response = api_client.post('/api/portal/auth/login/', {})
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_login_empty_dni(self, api_client, db):
        """Login with empty DNI returns validation error."""
        response = api_client.post('/api/portal/auth/login/', {
            'dni': ''
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_dni_special_chars_rejected(self, api_client, db):
        """Login with special characters in DNI returns validation error."""
        response = api_client.post('/api/portal/auth/login/', {
            'dni': '12345678!'
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'caracteres especiales' in str(response.data)

    def test_login_dni_too_long_rejected(self, api_client, db):
        """Login with DNI over 15 chars returns validation error."""
        response = api_client.post('/api/portal/auth/login/', {
            'dni': 'A' * 16
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_dni_too_short_rejected(self, api_client, db):
        """Login with DNI under 7 chars returns validation error."""
        response = api_client.post('/api/portal/auth/login/', {
            'dni': '123456'
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_dni_with_spaces_trimmed(self, api_client, alumno):
        """Login with DNI containing leading/trailing spaces is trimmed."""
        response = api_client.post('/api/portal/auth/login/', {
            'dni': '  12345678  '
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data


class TestPortalLogout:
    """Tests for POST /api/portal/auth/logout/"""
    
    def test_logout_success(self, api_client, alumno):
        """Valid refresh token can be blacklisted."""
        # First login to get tokens
        login_response = api_client.post('/api/portal/auth/login/', {
            'dni': '12345678'
        })
        refresh_token = login_response.data['refresh']
        
        # Logout with the refresh token
        response = api_client.post('/api/portal/auth/logout/', {
            'refresh': refresh_token
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['detail'] == 'Sesión cerrada'
    
    def test_logout_invalid_token(self, api_client, db):
        """Logout with invalid token returns 401."""
        response = api_client.post('/api/portal/auth/logout/', {
            'refresh': 'invalid-token'
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_logout_missing_token(self, api_client, db):
        """Logout without refresh token returns 400."""
        response = api_client.post('/api/portal/auth/logout/', {})
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestPortalRefresh:
    """Tests for POST /api/portal/auth/refresh/"""
    
    def test_refresh_success(self, api_client, alumno):
        """Valid refresh token returns new access token."""
        # First login
        login_response = api_client.post('/api/portal/auth/login/', {
            'dni': '12345678'
        })
        old_refresh = login_response.data['refresh']
        
        # Use refresh token to get new access token
        response = api_client.post('/api/portal/auth/refresh/', {
            'refresh': old_refresh
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
    
    def test_refresh_invalid_token(self, api_client, db):
        """Invalid refresh token returns 401."""
        response = api_client.post('/api/portal/auth/refresh/', {
            'refresh': 'invalid-token'
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
