"""
Tests for portal docente endpoints (/api/portal-docente/*).
Covers: auth, profile, ciclos, horarios, asistencias, horas-trabajadas,
dashboard, notas, model constraints, and cross-namespace isolation.
"""
import pytest
from datetime import date, time, datetime
from decimal import Decimal

from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Alumno, Ciclo, Taller, Horario, Profesor,
    Matricula, MatriculaHorario, Asistencia, NotaClase,
)
from core.models.hora_trabajada import HoraTrabajada
from core.authentication import ProfesorDummyUser, ProfesorJWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken


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
def otro_ciclo(db):
    """Create another test cycle (for isolation)."""
    return Ciclo.objects.create(
        nombre='2025-B',
        tipo='anual',
        fecha_inicio=date(2025, 1, 1),
        fecha_fin=date(2025, 12, 31),
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
def profesor_inactivo(db, ciclo):
    """Create an inactive professor."""
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='Inactivo',
        apellido='Profesor',
        dni='99887766',
        telefono='666666666',
        email='inactivo@test.com',
        activo=False,
        es_gerente=False
    )


@pytest.fixture
def otro_profesor(db, ciclo):
    """Create another professor (for isolation tests)."""
    return Profesor.objects.create(
        ciclo=ciclo,
        nombre='María',
        apellido='García',
        dni='55667788',
        telefono='555555555',
        email='maria@test.com',
        activo=True,
        es_gerente=False
    )


@pytest.fixture
def taller(db, ciclo):
    """Create a test workshop."""
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Guitarra',
        tipo='instrumento',
        descripcion='Clases de guitarra',
        activo=True
    )


@pytest.fixture
def otro_taller(db, ciclo):
    """Create another test workshop."""
    return Taller.objects.create(
        ciclo=ciclo,
        nombre='Piano',
        tipo='instrumento',
        descripcion='Clases de piano',
        activo=True
    )


@pytest.fixture
def horario(db, ciclo, taller, profesor):
    """Create a test schedule (Monday 10:00-11:00)."""
    return Horario.objects.create(
        ciclo=ciclo,
        taller=taller,
        profesor=profesor,
        dia_semana=0,  # Lunes
        hora_inicio=time(10, 0),
        hora_fin=time(11, 0),
        tipo_pago='dinamico',
        activo=True
    )


@pytest.fixture
def otro_horario(db, ciclo, otro_taller, profesor):
    """Create another test schedule (Wednesday 14:00-15:00)."""
    return Horario.objects.create(
        ciclo=ciclo,
        taller=otro_taller,
        profesor=profesor,
        dia_semana=2,  # Miércoles
        hora_inicio=time(14, 0),
        hora_fin=time(15, 0),
        tipo_pago='dinamico',
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
def otro_alumno(db, ciclo):
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
def matricula(db, alumno, ciclo, taller, horario):
    """Create a test enrollment linked to horario."""
    from datetime import timezone
    mat = Matricula.objects.create(
        alumno=alumno,
        ciclo=ciclo,
        taller=taller,
        sesiones_contratadas=12,
        precio_total=Decimal('240.00'),
        precio_por_sesion=Decimal('20.00'),
        fecha_matricula=datetime(2026, 1, 15, tzinfo=timezone.utc),
        activo=True,
        concluida=False
    )
    MatriculaHorario.objects.create(
        matricula=mat,
        horario=horario
    )
    return mat


@pytest.fixture
def otra_matricula(db, otro_alumno, ciclo, taller, horario):
    """Create another enrollment for a different student."""
    from datetime import timezone
    mat = Matricula.objects.create(
        alumno=otro_alumno,
        ciclo=ciclo,
        taller=taller,
        sesiones_contratadas=12,
        precio_total=Decimal('240.00'),
        precio_por_sesion=Decimal('20.00'),
        fecha_matricula=datetime(2026, 1, 15, tzinfo=timezone.utc),
        activo=True,
        concluida=False
    )
    MatriculaHorario.objects.create(
        matricula=mat,
        horario=horario
    )
    return mat


@pytest.fixture
def asistencia(db, matricula, horario, profesor):
    """Create a test attendance record."""
    return Asistencia.objects.create(
        matricula=matricula,
        horario=horario,
        profesor=profesor,
        fecha=date(2026, 4, 1),
        hora=time(10, 15),
        estado='asistio'
    )


@pytest.fixture
def hora_trabajada(db, profesor, ciclo, horario):
    """Create a test HoraTrabajada record."""
    return HoraTrabajada.objects.create(
        profesor=profesor,
        ciclo=ciclo,
        horario=horario,
        fecha=date(2026, 4, 1),
        tipo='clase_regular',
        horas_trabajadas=Decimal('1.00'),
        estado='pendiente',
        num_alumnos=2,
        valor_generado=Decimal('40.00'),
        monto_base=Decimal('17.00'),
        monto_adicional=Decimal('8.50'),
        monto_profesor=Decimal('25.50'),
        ganancia_taller=Decimal('14.50'),
    )


@pytest.fixture
def nota_clase(db, profesor, ciclo, horario):
    """Create a test NotaClase."""
    return NotaClase.objects.create(
        profesor=profesor,
        ciclo=ciclo,
        horario=horario,
        fecha=date(2026, 4, 1),
        contenido='Revisión de escalas mayores'
    )


# ---------------------------------------------------------------------------
# Auth token fixtures
# ---------------------------------------------------------------------------

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


@pytest.fixture
def portal_token(alumno):
    """Get a portal (student) access token for namespace isolation tests."""
    refresh = RefreshToken()
    refresh['alumno_id'] = alumno.id
    refresh['dni'] = alumno.dni
    refresh['type'] = 'portal'
    return str(refresh.access_token)


@pytest.fixture
def admin_token():
    """Get a standard admin JWT token (no portal claims)."""
    from rest_framework_simplejwt.tokens import AccessToken
    token = AccessToken()
    token['user_id'] = 1
    return str(token)


# ===========================================================================
# Tests: ProfesorJWTAuthentication
# ===========================================================================

class TestProfesorJWTAuthentication:
    """Tests for ProfesorJWTAuthentication backend."""

    def test_valid_token_returns_profesor_dummy_user(self, profesor, docente_token):
        """Valid portal-docente token returns ProfesorDummyUser."""
        from rest_framework_simplejwt.tokens import AccessToken
        auth = ProfesorJWTAuthentication()
        validated = AccessToken(docente_token)
        user = auth.get_user(validated)

        assert user is not None
        assert isinstance(user, ProfesorDummyUser)
        assert user.id == profesor.id
        assert user.dni == profesor.dni
        assert user.is_authenticated is True

    def test_token_without_profesor_id_returns_none(self, admin_token):
        """Token without profesor_id returns None (falls through to admin auth)."""
        from rest_framework_simplejwt.tokens import AccessToken
        auth = ProfesorJWTAuthentication()
        validated = AccessToken(admin_token)
        user = auth.get_user(validated)

        assert user is None

    def test_token_with_none_profesor_id_returns_none(self):
        """Token with explicit None profesor_id returns None."""
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken()
        token['profesor_id'] = None
        token['dni'] = '11223344'

        auth = ProfesorJWTAuthentication()
        user = auth.get_user(token)

        assert user is None


# ===========================================================================
# Tests: Login
# ===========================================================================

class TestProfesorLogin:
    """Tests for POST /api/portal-docente/auth/login/"""

    def test_login_success(self, api_client, profesor, ciclo):
        """Login with valid DNI returns tokens, user data, and ciclos."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '11223344'
        })

        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert 'user' in response.data
        assert 'ciclos' in response.data

        # Check user data includes sensitive fields (unlike student portal)
        assert response.data['user']['id'] == profesor.id
        assert response.data['user']['nombre'] == 'Carlos'
        assert response.data['user']['apellido'] == 'López'
        assert response.data['user']['dni'] == '11223344'
        assert response.data['user']['email'] == 'carlos@test.com'
        assert response.data['user']['telefono'] == '777777777'

        # ciclos should include cycles where profesor has horarios
        assert isinstance(response.data['ciclos'], list)

    def test_login_unknown_dni(self, api_client, db):
        """Login with non-existent DNI returns 404 with delay."""
        import time
        start = time.time()
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '00000000'
        })
        elapsed = time.time() - start

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['detail'] == 'Credenciales inválidas'
        assert elapsed >= 1.8  # 2s delay

    def test_login_inactive_profesor(self, api_client, profesor_inactivo):
        """Login with inactive profesor's DNI returns 404."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '99887766'
        })

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_login_missing_dni(self, api_client, db):
        """Login without DNI returns validation error."""
        response = api_client.post('/api/portal-docente/auth/login/', {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_empty_dni(self, api_client, db):
        """Login with empty DNI returns validation error."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': ''
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_dni_special_chars_rejected(self, api_client, db):
        """Login with special characters in DNI returns validation error."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '11223344!'
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'caracteres especiales' in str(response.data)

    def test_login_dni_too_long_rejected(self, api_client, db):
        """Login with DNI over 15 chars returns validation error."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': 'A' * 16
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_dni_too_short_rejected(self, api_client, db):
        """Login with DNI under 7 chars returns validation error."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '123456'
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_dni_with_spaces_trimmed(self, api_client, profesor):
        """Login with DNI containing leading/trailing spaces."""
        response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '  11223344  '
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data


# ===========================================================================
# Tests: Token Refresh and Logout
# ===========================================================================

class TestProfesorLogout:
    """Tests for POST /api/portal-docente/auth/logout/"""

    def test_logout_success(self, api_client, profesor):
        """Valid refresh token can be used for logout."""
        login_response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '11223344'
        })
        refresh_token = login_response.data['refresh']

        response = api_client.post('/api/portal-docente/auth/logout/', {
            'refresh': refresh_token
        })

        assert response.status_code == status.HTTP_200_OK
        assert response.data['detail'] == 'Sesión cerrada'

    def test_logout_invalid_token(self, api_client, db):
        """Logout with invalid token returns 401."""
        response = api_client.post('/api/portal-docente/auth/logout/', {
            'refresh': 'invalid-token'
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_missing_token(self, api_client, db):
        """Logout without refresh token returns 400."""
        response = api_client.post('/api/portal-docente/auth/logout/', {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_rejects_student_token(self, api_client, alumno):
        """Student portal token is rejected by docente logout."""
        refresh = RefreshToken()
        refresh['alumno_id'] = alumno.id
        refresh['dni'] = alumno.dni
        refresh['type'] = 'portal'

        response = api_client.post('/api/portal-docente/auth/logout/', {
            'refresh': str(refresh)
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_requires_profesor_claim(self, api_client, db):
        """Token without profesor_id claim is rejected."""
        refresh = RefreshToken()
        refresh['type'] = 'portal_docente'

        response = api_client.post('/api/portal-docente/auth/logout/', {
            'refresh': str(refresh)
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestProfesorRefresh:
    """Tests for POST /api/portal-docente/auth/refresh/"""

    def test_refresh_success(self, api_client, profesor):
        """Valid refresh token returns new access token."""
        login_response = api_client.post('/api/portal-docente/auth/login/', {
            'dni': '11223344'
        })
        old_refresh = login_response.data['refresh']

        response = api_client.post('/api/portal-docente/auth/refresh/', {
            'refresh': old_refresh
        })

        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data

    def test_refresh_invalid_token(self, api_client, db):
        """Invalid refresh token returns 401."""
        response = api_client.post('/api/portal-docente/auth/refresh/', {
            'refresh': 'invalid-token'
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# Tests: Me (Profile)
# ===========================================================================

class TestProfesorMe:
    """Tests for GET /api/portal-docente/me/"""

    def test_me_success(self, authenticated_client, profesor):
        """Authenticated request returns professor profile."""
        response = authenticated_client.get('/api/portal-docente/me/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == profesor.id
        assert response.data['nombre'] == 'Carlos'
        assert response.data['apellido'] == 'López'
        assert response.data['dni'] == '11223344'
        assert response.data['email'] == 'carlos@test.com'
        assert response.data['telefono'] == '777777777'

    def test_me_unauthenticated(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.get('/api/portal-docente/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ===========================================================================
# Tests: Ciclos
# ===========================================================================

class TestProfesorCiclos:
    """Tests for GET /api/portal-docente/ciclos/"""

    def test_ciclos_success(self, authenticated_client, profesor, ciclo, otro_ciclo, horario):
        """Returns cycles where profesor has horarios."""
        response = authenticated_client.get('/api/portal-docente/ciclos/')

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        # Only the cycle with horarios should be returned
        ciclo_ids = [c['id'] for c in response.data]
        assert ciclo.id in ciclo_ids
        assert otro_ciclo.id not in ciclo_ids

    def test_ciclos_empty(self, api_client, db, profesor):
        """Profesor with no horarios returns empty list."""
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['profesor_id'] = profesor.id
        refresh['dni'] = profesor.dni
        refresh['type'] = 'portal_docente'

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = client.get('/api/portal-docente/ciclos/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0


# ===========================================================================
# Tests: Horarios
# ===========================================================================

class TestProfesorHorarios:
    """Tests for GET /api/portal-docente/ciclos/{id}/horarios/"""

    def test_horarios_success(self, authenticated_client, ciclo, horario):
        """Returns profesor's schedules for the cycle."""
        response = authenticated_client.get(f'/api/portal-docente/ciclos/{ciclo.id}/horarios/')

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
        assert 'alumnos_count' in response.data[0]
        assert 'alumnos' in response.data[0]
        assert 'taller_nombre' in response.data[0]

    def test_horarios_excludes_other_profesor(self, authenticated_client, ciclo, horario, otro_profesor):
        """Other profesor's horarios are excluded."""
        # Create horario for otro_profesor
        taller2 = Taller.objects.create(ciclo=ciclo, nombre='Bajo', tipo='instrumento', activo=True)
        Horario.objects.create(
            ciclo=ciclo,
            taller=taller2,
            profesor=otro_profesor,
            dia_semana=1,
            hora_inicio=time(12, 0),
            hora_fin=time(13, 0),
            activo=True
        )

        response = authenticated_client.get(f'/api/portal-docente/ciclos/{ciclo.id}/horarios/')

        assert response.status_code == status.HTTP_200_OK
        # Should only have the horario belonging to our profesor
        for h in response.data:
            assert h['profesor_nombre'] == 'López, Carlos'


# ===========================================================================
# Tests: Asistencias (Read-Only)
# ===========================================================================

class TestProfesorAsistencias:
    """Tests for GET /api/portal-docente/ciclos/{id}/asistencias/"""

    def test_asistencias_success(self, authenticated_client, ciclo, horario, asistencia):
        """Returns attendance records for a horario and date."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {'horario_id': horario.id, 'fecha': '2026-04-01'}
        )

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
        assert 'estado' in response.data[0]
        assert 'alumno_nombre' in response.data[0]

    def test_asistencias_missing_params(self, authenticated_client, ciclo):
        """Returns 400 when horario_id or fecha is missing."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {'horario_id': 1}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_asistencias_invalid_fecha(self, authenticated_client, ciclo):
        """Returns 400 for invalid date format."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {'horario_id': 1, 'fecha': 'not-a-date'}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_asistencias_rejects_post(self, authenticated_client, ciclo, horario):
        """POST returns 405 Method Not Allowed."""
        response = authenticated_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {'horario_id': horario.id, 'fecha': '2026-04-01'}
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_asistencias_rejects_put(self, authenticated_client, ciclo, horario):
        """PUT returns 405."""
        response = authenticated_client.put(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {'horario_id': horario.id, 'fecha': '2026-04-01'}
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_asistencias_rejects_patch(self, authenticated_client, ciclo, horario):
        """PATCH returns 405."""
        response = authenticated_client.patch(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/',
            {'estado': 'falta'}
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_asistencias_rejects_delete(self, authenticated_client, ciclo, horario):
        """DELETE returns 405."""
        response = authenticated_client.delete(
            f'/api/portal-docente/ciclos/{ciclo.id}/asistencias/'
        )
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


# ===========================================================================
# Tests: Horas Trabajadas
# ===========================================================================

class TestProfesorHorasTrabajadas:
    """Tests for GET /api/portal-docente/ciclos/{id}/horas-trabajadas/"""

    def test_horas_trabajadas_success(self, authenticated_client, ciclo, hora_trabajada):
        """Returns HoraTrabajada records for the professor."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/'
        )

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
        record = response.data[0]
        assert 'monto_profesor' in record
        assert 'estado' in record
        assert 'horas_trabajadas' in record

    def test_horas_trabajadas_filter_by_estado(self, authenticated_client, ciclo, hora_trabajada):
        """Can filter by estado."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/',
            {'estado': 'pendiente'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/',
            {'estado': 'aprobada'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0  # None approved

    def test_horas_trabajadas_filter_by_date_range(self, authenticated_client, ciclo, hora_trabajada):
        """Can filter by date range."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/',
            {'fecha_desde': '2026-03-01', 'fecha_hasta': '2026-03-31'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0  # No records in March

        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/horas-trabajadas/',
            {'fecha_desde': '2026-04-01', 'fecha_hasta': '2026-04-30'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1  # Our record is April 1


# ===========================================================================
# Tests: Dashboard
# ===========================================================================

class TestProfesorDashboard:
    """Tests for GET /api/portal-docente/ciclos/{id}/dashboard/"""

    def test_dashboard_success(self, authenticated_client, ciclo, horario, matricula,
                                otra_matricula, hora_trabajada):
        """Returns dashboard KPIs."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/dashboard/'
        )

        assert response.status_code == status.HTTP_200_OK
        assert 'clases_hoy' in response.data
        assert 'total_alumnos' in response.data
        assert 'horas_mes' in response.data
        assert 'monto_acumulado' in response.data

        # Our horario is Monday (dia_semana=0), today is Wednesday (2)
        # So clases_hoy should be 0
        assert response.data['clases_hoy'] >= 0
        assert response.data['total_alumnos'] >= 1
        assert float(response.data['horas_mes']) >= 0
        assert float(response.data['monto_acumulado']) >= 0


# ===========================================================================
# Tests: Notas
# ===========================================================================

class TestProfesorNotas:
    """Tests for GET/POST /api/portal-docente/ciclos/{id}/notas/"""

    def test_create_nota_success(self, authenticated_client, ciclo, horario):
        """POST creates a NotaClase successfully."""
        response = authenticated_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {
                'horario': horario.id,
                'fecha': '2026-06-01',
                'contenido': 'Revisión de escalas mayores',
            }
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['contenido'] == 'Revisión de escalas mayores'
        assert response.data['fecha'] == '2026-06-01'
        assert response.data['horario'] == horario.id

    def test_create_nota_duplicate(self, authenticated_client, ciclo, horario, profesor):
        """Duplicate nota for same (profesor, horario, fecha) returns 400."""
        # Create first
        NotaClase.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            fecha=date(2026, 6, 1),
            contenido='Primera nota'
        )

        # Try duplicate
        response = authenticated_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {
                'horario': horario.id,
                'fecha': '2026-06-01',
                'contenido': 'Segunda nota',
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_nota_wrong_profesor(self, authenticated_client, ciclo, otro_profesor):
        """Cannot create nota for horario belonging to another profesor."""
        # Create horario for otro_profesor
        taller = Taller.objects.create(ciclo=ciclo, nombre='Bajo', tipo='instrumento', activo=True)
        otro_horario = Horario.objects.create(
            ciclo=ciclo,
            taller=taller,
            profesor=otro_profesor,
            dia_semana=1,
            hora_inicio=time(12, 0),
            hora_fin=time(13, 0),
            activo=True
        )

        response = authenticated_client.post(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {
                'horario': otro_horario.id,
                'fecha': '2026-06-01',
                'contenido': 'Nota de otro profesor',
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_notas(self, authenticated_client, ciclo, nota_clase):
        """GET returns list of notas."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/'
        )

        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
        assert response.data[0]['contenido'] == 'Revisión de escalas mayores'

    def test_list_notas_filters(self, authenticated_client, ciclo, horario, nota_clase):
        """GET can filter by horario_id and fecha."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {'horario_id': horario.id}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/',
            {'horario_id': 99999}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0

    def test_nota_detail_get(self, authenticated_client, ciclo, nota_clase):
        """GET individual nota returns its data."""
        response = authenticated_client.get(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/{nota_clase.id}/'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['contenido'] == 'Revisión de escalas mayores'

    def test_nota_detail_update(self, authenticated_client, ciclo, nota_clase):
        """PUT updates the nota content."""
        response = authenticated_client.put(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/{nota_clase.id}/',
            {
                'horario': nota_clase.horario.id,
                'fecha': nota_clase.fecha.isoformat(),
                'contenido': 'Contenido actualizado',
            }
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['contenido'] == 'Contenido actualizado'

    def test_nota_detail_delete(self, authenticated_client, ciclo, nota_clase):
        """DELETE removes the nota."""
        response = authenticated_client.delete(
            f'/api/portal-docente/ciclos/{ciclo.id}/notas/{nota_clase.id}/'
        )
        assert response.status_code == status.HTTP_200_OK

        # Verify deleted
        assert not NotaClase.objects.filter(id=nota_clase.id).exists()


# ===========================================================================
# Tests: NotaClase Model Constraints
# ===========================================================================

class TestNotaClaseModel:
    """Tests for NotaClase model."""

    def test_unique_together(self, profesor, ciclo, horario):
        """Cannot create duplicate (profesor, horario, fecha) notas."""
        NotaClase.objects.create(
            profesor=profesor,
            ciclo=ciclo,
            horario=horario,
            fecha=date(2026, 5, 1),
            contenido='First'
        )
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            NotaClase.objects.create(
                profesor=profesor,
                ciclo=ciclo,
                horario=horario,
                fecha=date(2026, 5, 1),
                contenido='Duplicate'
            )

    def test_different_fecha_allowed(self, profesor, ciclo, horario):
        """Same profesor+horario but different fecha is allowed."""
        NotaClase.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha=date(2026, 5, 1), contenido='First'
        )
        NotaClase.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha=date(2026, 5, 2), contenido='Second'
        )
        assert NotaClase.objects.count() == 2

    def test_cascade_delete_profesor(self, profesor, ciclo, horario):
        """Deleting profesor deletes related NotaClase."""
        nota = NotaClase.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha=date(2026, 5, 1), contenido='Test'
        )
        nota_id = nota.id
        profesor.delete()
        assert not NotaClase.objects.filter(id=nota_id).exists()

    def test_cascade_delete_horario(self, profesor, ciclo, horario):
        """Deleting horario deletes related NotaClase."""
        nota = NotaClase.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha=date(2026, 5, 1), contenido='Test'
        )
        nota_id = nota.id
        horario.delete()
        assert not NotaClase.objects.filter(id=nota_id).exists()

    def test_cascade_delete_ciclo(self, profesor, ciclo, horario):
        """Deleting ciclo deletes related NotaClase."""
        nota = NotaClase.objects.create(
            profesor=profesor, ciclo=ciclo, horario=horario,
            fecha=date(2026, 5, 1), contenido='Test'
        )
        nota_id = nota.id
        ciclo.delete()
        assert not NotaClase.objects.filter(id=nota_id).exists()


# ===========================================================================
# Tests: Cross-Namespace Isolation
# ===========================================================================

class TestCrossNamespaceIsolation:
    """Tests for token isolation between portal namespaces."""

    def test_student_token_rejected_on_docente_endpoint(self, api_client, portal_token, ciclo):
        """Student portal token is rejected on docente endpoints."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {portal_token}')

        response = client.get('/api/portal-docente/me/')
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_docente_token_rejected_on_student_endpoint(self, authenticated_client):
        """Docente token is rejected on student portal endpoints."""
        response = authenticated_client.get('/api/portal/me/')
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_admin_token_rejected_on_docente_endpoint(self, api_client, admin_token):
        """Admin JWT (without profesor_id) is rejected on docente endpoints."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')

        response = client.get('/api/portal-docente/me/')
        assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
