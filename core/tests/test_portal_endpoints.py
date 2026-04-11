"""
Tests for portal data endpoints (/api/portal/me/*).
All tests require authentication.
"""
import pytest
from datetime import date, time
from decimal import Decimal

from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    Alumno, Ciclo, Taller, Horario, Profesor,
    Matricula, MatriculaHorario, Asistencia, Recibo, ReciboMatricula
)


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
    """Create another test cycle."""
    return Ciclo.objects.create(
        nombre='2025-B',
        tipo='anual',
        fecha_inicio=date(2025, 1, 1),
        fecha_fin=date(2025, 12, 31),
        activo=True
    )


@pytest.fixture
def profesor(db, ciclo):
    """Create a test teacher."""
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
    """Create a test schedule."""
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
    """Create another test schedule."""
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
def matricula(db, alumno, ciclo, taller):
    """Create a test enrollment."""
    return Matricula.objects.create(
        alumno=alumno,
        ciclo=ciclo,
        taller=taller,
        sesiones_contratadas=12,
        precio_total=Decimal('240.00'),
        precio_por_sesion=Decimal('20.00'),
        activo=True,
        concluida=False
    )


@pytest.fixture
def matricula_concluida(db, alumno, ciclo, otro_taller):
    """Create a concluded enrollment."""
    return Matricula.objects.create(
        alumno=alumno,
        ciclo=ciclo,
        taller=otro_taller,
        sesiones_contratadas=8,
        precio_total=Decimal('160.00'),
        precio_por_sesion=Decimal('20.00'),
        activo=True,
        concluida=True
    )


@pytest.fixture
def matricula_horario(db, matricula, horario):
    """Link enrollment to schedule."""
    return MatriculaHorario.objects.create(
        matricula=matricula,
        horario=horario
    )


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
def recibo(db, alumno, ciclo, matricula):
    """Create a test receipt with pending balance."""
    recibo = Recibo.objects.create(
        numero='R-001',
        ciclo=ciclo,
        fecha_emision=date(2026, 3, 1),
        monto_bruto=Decimal('240.00'),
        monto_total=Decimal('240.00'),
        monto_pagado=Decimal('80.00'),
        descuento=Decimal('0.00'),
        estado='pendiente'
    )
    ReciboMatricula.objects.create(
        recibo=recibo,
        matricula=matricula,
        monto=Decimal('240.00')
    )
    return recibo


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


class TestPortalMe:
    """Tests for GET /api/portal/me/"""
    
    def test_me_success(self, authenticated_client, alumno):
        """Authenticated request returns student profile."""
        response = authenticated_client.get('/api/portal/me/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == alumno.id
        assert response.data['nombre'] == 'Test'
        assert response.data['apellido'] == 'Student'
    
    def test_me_excludes_sensitive_fields(self, authenticated_client, alumno):
        """Profile does NOT include sensitive fields."""
        response = authenticated_client.get('/api/portal/me/')
        
        assert 'dni' not in response.data
        assert 'email' not in response.data
        assert 'telefono' not in response.data
        assert 'fecha_nacimiento' not in response.data
    
    def test_me_unauthenticated(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.get('/api/portal/me/')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestPortalCiclos:
    """Tests for GET /api/portal/me/ciclos/"""
    
    def test_ciclos_success(self, authenticated_client, alumno, ciclo, matricula):
        """Returns cycles where student has enrollments."""
        response = authenticated_client.get('/api/portal/me/ciclos/')
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
        
        ciclo_data = response.data[0]
        assert ciclo_data['nombre'] == '2026-A'
        assert ciclo_data['has_matricula_activa'] == True
    
    def test_ciclos_empty(self, authenticated_client, db):
        """Student with no enrollments returns empty list."""
        # Create student without enrollment
        Ciclo.objects.create(
            nombre='Empty-Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        # Create an alumno without matricula using the test fixture but separate
        from rest_framework_simplejwt.tokens import RefreshToken
        empty_alumno = Alumno.objects.create(
            ciclo=Ciclo.objects.first(),
            nombre='NoEnrollment',
            apellido='Student',
            dni='11111111',
            telefono='111111111',
            email='noenrollment@test.com',
            fecha_nacimiento=date(2010, 1, 1),
            activo=True
        )
        
        refresh = RefreshToken()
        refresh['alumno_id'] = empty_alumno.id
        refresh['dni'] = empty_alumno.dni
        refresh['type'] = 'portal'
        
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
        
        response = client.get('/api/portal/me/ciclos/')
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 0


class TestPortalMatriculas:
    """Tests for GET /api/portal/me/matriculas/"""
    
    def test_matriculas_success(self, authenticated_client, alumno, ciclo, matricula, matricula_concluida):
        """Returns enrollments grouped by status."""
        response = authenticated_client.get(f'/api/portal/me/matriculas/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'activas' in response.data
        assert 'concluidas' in response.data
        assert len(response.data['activas']) == 1
        assert len(response.data['concluidas']) == 1
    
    def test_matriculas_requires_ciclo_id(self, authenticated_client):
        """Returns 400 if ciclo_id is missing."""
        response = authenticated_client.get('/api/portal/me/matriculas/')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'ciclo_id' in str(response.data)
    
    def test_matriculas_includes_taller(self, authenticated_client, ciclo, taller, matricula):
        """Enrollment data includes taller info."""
        response = authenticated_client.get(f'/api/portal/me/matriculas/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['activas'][0]['taller']['nombre'] == 'Guitarra'


class TestPortalAsistencias:
    """Tests for GET /api/portal/me/asistencias/"""
    
    def test_asistencias_success(self, authenticated_client, ciclo, asistencia):
        """Returns attendance records."""
        response = authenticated_client.get(f'/api/portal/me/asistencias/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
    
    def test_asistencias_includes_details(self, authenticated_client, ciclo, asistencia, horario):
        """Attendance includes taller and professor names."""
        response = authenticated_client.get(f'/api/portal/me/asistencias/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        record = response.data[0]
        assert 'taller_nombre' in record
        assert 'profesor_nombre' in record
        assert record['estado'] == 'asistio'
    
    def test_asistencias_requires_ciclo_id(self, authenticated_client):
        """Returns 400 if ciclo_id is missing."""
        response = authenticated_client.get('/api/portal/me/asistencias/')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestPortalHorarios:
    """Tests for GET /api/portal/me/horarios/"""
    
    def test_horarios_success(self, authenticated_client, ciclo, horario, matricula_horario):
        """Returns student's weekly schedule."""
        response = authenticated_client.get(f'/api/portal/me/horarios/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        assert len(response.data) >= 1
    
    def test_horarios_includes_taller_profesor(self, authenticated_client, ciclo, horario, matricula_horario):
        """Schedule includes taller and professor names."""
        response = authenticated_client.get(f'/api/portal/me/horarios/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        item = response.data[0]
        assert 'taller_nombre' in item
        assert 'profesor_nombre' in item
        assert 'dia_semana' in item
    
    def test_horarios_requires_ciclo_id(self, authenticated_client):
        """Returns 400 if ciclo_id is missing."""
        response = authenticated_client.get('/api/portal/me/horarios/')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestPortalPagos:
    """Tests for GET /api/portal/me/pagos/"""
    
    def test_pagos_success(self, authenticated_client, ciclo, recibo):
        """Returns receipts with pending balance."""
        response = authenticated_client.get(f'/api/portal/me/pagos/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.data, list)
        # The recibo has saldo_pendiente = 160, so it should be included
        assert len(response.data) == 1
        assert response.data[0]['numero'] == 'R-001'
    
    def test_pagos_excludes_paid_receipts(self, authenticated_client, alumno, ciclo, matricula):
        """Receipts with no pending balance are excluded."""
        # Create a fully paid receipt (no pending balance)
        paid_recibo = Recibo.objects.create(
            numero='R-002',
            ciclo=ciclo,
            fecha_emision=date(2026, 3, 1),
            monto_bruto=Decimal('240.00'),
            monto_total=Decimal('240.00'),
            monto_pagado=Decimal('240.00'),
            descuento=Decimal('0.00'),
            estado='pagado'
        )
        ReciboMatricula.objects.create(
            recibo=paid_recibo,
            matricula=matricula,
            monto=Decimal('240.00')
        )
        
        response = authenticated_client.get(f'/api/portal/me/pagos/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        # Paid receipt should be excluded (no pending balance)
        # Since no pending receipts exist, result should be empty
        assert len(response.data) == 0
    
    def test_pagos_requires_ciclo_id(self, authenticated_client):
        """Returns 400 if ciclo_id is missing."""
        response = authenticated_client.get('/api/portal/me/pagos/')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestPortalDashboard:
    """Tests for GET /api/portal/me/dashboard/"""
    
    def test_dashboard_success(self, authenticated_client, ciclo, matricula, asistencia):
        """Returns aggregated dashboard data."""
        response = authenticated_client.get(f'/api/portal/me/dashboard/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'alumno' in response.data
        assert 'ciclo_activo' in response.data
        assert 'matriculas_activas' in response.data
        assert 'horarios_proximos' in response.data
        assert 'ultimas_asistencias' in response.data
        assert 'asistencia_stats' in response.data
        assert 'pagos_pendientes' in response.data
    
    def test_dashboard_asistencia_stats(self, authenticated_client, ciclo, asistencia):
        """Dashboard includes attendance statistics."""
        response = authenticated_client.get(f'/api/portal/me/dashboard/?ciclo_id={ciclo.id}')
        
        assert response.status_code == status.HTTP_200_OK
        stats = response.data['asistencia_stats']
        assert 'total' in stats
        assert 'asistidas' in stats
        assert 'faltas' in stats
        assert 'porcentaje' in stats
    
    def test_dashboard_requires_ciclo_id(self, authenticated_client):
        """Returns 400 if ciclo_id is missing."""
        response = authenticated_client.get('/api/portal/me/dashboard/')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
