"""
Tests for get_profesor_for_ciclo helper in core/authentication.py.

Covers: found, not-found (404), cross-cycle resolution, legacy fallback.
"""
import pytest
from datetime import date

from django.http import Http404
from rest_framework.test import APIClient

from core.models import Ciclo, Profesor
from core.authentication import get_profesor_for_ciclo


@pytest.fixture
def api_client():
    """API client for testing."""
    return APIClient()


@pytest.fixture
def ciclo_a(db):
    """Cycle A."""
    return Ciclo.objects.create(
        nombre='2026-A',
        tipo='anual',
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
        activo=True,
    )


@pytest.fixture
def ciclo_b(db):
    """Cycle B."""
    return Ciclo.objects.create(
        nombre='2026-B',
        tipo='verano',
        fecha_inicio=date(2026, 6, 1),
        fecha_fin=date(2026, 8, 31),
        activo=True,
    )


@pytest.fixture
def profesor_a(db, ciclo_a):
    """Profesor in cycle A."""
    return Profesor.objects.create(
        ciclo=ciclo_a,
        nombre='Carlos',
        apellido='López',
        dni='11223344',
        telefono='777777777',
        email='carlos@test.com',
        activo=True,
    )


@pytest.fixture
def profesor_b(db, ciclo_b):
    """Same teacher but different ID in cycle B."""
    return Profesor.objects.create(
        ciclo=ciclo_b,
        nombre='Carlos',
        apellido='López',
        dni='11223344',
        telefono='777777777',
        email='carlos@test.com',
        activo=True,
    )


class TestGetProfesorForCiclo:
    """Tests for get_profesor_for_ciclo()."""

    def test_found(self, profesor_a, ciclo_a):
        """Resolves correct profesor_id for (dni, ciclo_id)."""
        result = get_profesor_for_ciclo(profesor_a.dni, ciclo_a.id)
        assert result == profesor_a.id

    def test_not_found_raises_404(self, ciclo_b):
        """Raises Http404 when profesor does not exist for ciclo."""
        with pytest.raises(Http404, match='Profesor no encontrado para este ciclo'):
            get_profesor_for_ciclo('99999999', ciclo_b.id)

    def test_cross_cycle_resolution(self, profesor_a, profesor_b, ciclo_a, ciclo_b):
        """Same DNI resolves different profesor_id per cycle."""
        id_a = get_profesor_for_ciclo(profesor_a.dni, ciclo_a.id)
        id_b = get_profesor_for_ciclo(profesor_b.dni, ciclo_b.id)
        assert id_a == profesor_a.id
        assert id_b == profesor_b.id
        assert id_a != id_b

    def test_inactive_profesor_not_found(self, ciclo_a):
        """Inactive profesor is not resolved."""
        inactive = Profesor.objects.create(
            ciclo=ciclo_a,
            nombre='Inactivo',
            apellido='Test',
            dni='99887766',
            telefono='666666666',
            email='inactivo@test.com',
            activo=False,
        )
        with pytest.raises(Http404):
            get_profesor_for_ciclo(inactive.dni, ciclo_a.id)

    @pytest.mark.parametrize('dni,expected', [
        ('11223344', True),
        ('00000000', False),
    ])
    def test_parametrized_resolution(self, dni, expected, profesor_a, ciclo_a):
        """Parametrized: found vs not-found."""
        if expected:
            result = get_profesor_for_ciclo(dni, ciclo_a.id)
            assert result == profesor_a.id
        else:
            with pytest.raises(Http404):
                get_profesor_for_ciclo(dni, ciclo_a.id)
