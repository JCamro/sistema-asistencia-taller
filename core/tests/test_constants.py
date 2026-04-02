"""
Tests para core/constants.py - Validación de constantes de pago.
"""
from decimal import Decimal

import pytest

from core.constants import BASE_PAGO, TOPE_MAXIMO, PORCENTAJE_ADICIONAL


class TestPaymentConstants:
    """Test case para validar las constantes de cálculo de pago."""

    def test_base_pago_valor_correcto(self):
        """Verifica que BASE_PAGO sea 17.00"""
        assert BASE_PAGO == Decimal('17.00')

    def test_tope_maximo_valor_correcto(self):
        """Verifica que TOPE_MAXIMO sea 35.00"""
        assert TOPE_MAXIMO == Decimal('35.00')

    def test_porcentaje_adicional_valor_correcto(self):
        """Verifica que PORCENTAJE_ADICIONAL sea 0.50"""
        assert PORCENTAJE_ADICIONAL == Decimal('0.50')

    def test_base_pago_es_decimal(self):
        """Verifica que BASE_PAGO sea tipo Decimal, no float"""
        assert isinstance(BASE_PAGO, Decimal)
        assert not isinstance(BASE_PAGO, float)

    def test_tope_maximo_es_decimal(self):
        """Verifica que TOPE_MAXIMO sea tipo Decimal, no float"""
        assert isinstance(TOPE_MAXIMO, Decimal)
        assert not isinstance(TOPE_MAXIMO, float)

    def test_porcentaje_adicional_es_decimal(self):
        """Verifica que PORCENTAJE_ADICIONAL sea tipo Decimal, no float"""
        assert isinstance(PORCENTAJE_ADICIONAL, Decimal)
        assert not isinstance(PORCENTAJE_ADICIONAL, float)

    def test_base_pago_positivo(self):
        """Verifica que BASE_PAGO sea mayor que cero"""
        assert BASE_PAGO > 0

    def test_tope_maximo_mayor_que_base(self):
        """Verifica que TOPE_MAXIMO sea mayor que BASE_PAGO"""
        assert TOPE_MAXIMO > BASE_PAGO

    def test_porcentaje_adicional_entre_0_y_1(self):
        """Verifica que PORCENTAJE_ADICIONAL esté entre 0 y 1 (50%)"""
        assert 0 < PORCENTAJE_ADICIONAL < 1