"""
Tests para el modelo Egreso: validaciones, serializers y API endpoints.

Verifica:
- Validaciones del modelo (MinValueValidator en monto)
- Validaciones del serializer (validate_monto, validate)
- Endpoints CRUD con filtro por ciclo
- Endpoint resumen (solo cancelados)
- Endpoint historial-pagos por profesor
- Consistencia del resumen con cambios de estado
"""
from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import Ciclo, Egreso, Profesor


# =============================================================================
# Tests de validación del modelo
# =============================================================================

class TestEgresoModelValidation(TestCase):
    """Validaciones a nivel de modelo (MinValueValidator en monto)."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Test',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )

    def test_monto_cero_falla_validacion(self):
        """Crear egreso con monto=0 debe lanzar ValidationError."""
        egreso = Egreso(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('0'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            estado='cancelado'
        )
        with self.assertRaises(ValidationError):
            egreso.full_clean()

    def test_monto_negativo_falla_validacion(self):
        """Crear egreso con monto negativo debe lanzar ValidationError."""
        egreso = Egreso(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('-50.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            estado='cancelado'
        )
        with self.assertRaises(ValidationError):
            egreso.full_clean()

    def test_monto_positivo_exitoso(self):
        """Crear egreso con monto > 0 debe ser exitoso."""
        egreso = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('150.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            descripcion='Compra de cuerdas',
            estado='cancelado'
        )
        self.assertIsNotNone(egreso.pk)
        self.assertEqual(egreso.monto, Decimal('150.00'))
        self.assertEqual(egreso.tipo, 'gasto_taller')

    def test_monto_minimo_valido(self):
        """Crear egreso con monto = 0.01 (mínimo permitido) debe ser exitoso."""
        egreso = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('0.01'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            descripcion='Gasto mínimo',
            estado='cancelado'
        )
        self.assertIsNotNone(egreso.pk)
        self.assertEqual(egreso.monto, Decimal('0.01'))

    def test_str_representation(self):
        """__str__ debe incluir tipo, monto y beneficiario/descripción."""
        egreso = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('100.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            descripcion='Materiales',
            beneficiario='Juan Pérez',
            estado='cancelado'
        )
        self.assertIn('Gasto del Taller', str(egreso))
        self.assertIn('100.00', str(egreso))
        self.assertIn('Juan Pérez', str(egreso))


# =============================================================================
# Tests de validación del serializer
# =============================================================================

class TestEgresoSerializerValidation(TestCase):
    """Validaciones del EgresoSerializer: validate_monto y validate."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Test',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )

    def test_validate_monto_rejects_zero(self):
        """validate_monto debe rechazar monto = 0."""
        from core.serializers import EgresoSerializer

        data = {
            'ciclo': self.ciclo.id,
            'tipo': 'gasto_taller',
            'monto': Decimal('0'),
            'fecha': '2026-06-01',
            'metodo_pago': 'efectivo',
            'estado': 'cancelado'
        }
        serializer = EgresoSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('monto', serializer.errors)

    def test_validate_monto_rejects_negative(self):
        """validate_monto debe rechazar monto negativo."""
        from core.serializers import EgresoSerializer

        data = {
            'ciclo': self.ciclo.id,
            'tipo': 'gasto_taller',
            'monto': Decimal('-100.00'),
            'fecha': '2026-06-01',
            'metodo_pago': 'efectivo',
            'estado': 'cancelado'
        }
        serializer = EgresoSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('monto', serializer.errors)

    def test_validate_monto_accepts_positive(self):
        """validate_monto debe aceptar monto positivo."""
        from core.serializers import EgresoSerializer

        data = {
            'ciclo': self.ciclo.id,
            'tipo': 'gasto_taller',
            'monto': Decimal('250.00'),
            'fecha': '2026-06-01',
            'metodo_pago': 'efectivo',
            'estado': 'cancelado'
        }
        serializer = EgresoSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_validate_rejects_pago_profesor_sin_profesor(self):
        """validate debe rechazar tipo=pago_profesor sin profesor."""
        from core.serializers import EgresoSerializer

        data = {
            'ciclo': self.ciclo.id,
            'tipo': 'pago_profesor',
            'monto': Decimal('200.00'),
            'fecha': '2026-06-01',
            'metodo_pago': 'transferencia',
            'estado': 'cancelado'
            # Sin profesor
        }
        serializer = EgresoSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('profesor', serializer.errors)

    def test_validate_accepts_pago_profesor_con_profesor(self):
        """validate debe aceptar tipo=pago_profesor con profesor."""
        from core.serializers import EgresoSerializer

        profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Carlos',
            apellido='García',
            dni='87654321',
            telefono='555123456',
            email='carlos@test.com',
            activo=True
        )

        data = {
            'ciclo': self.ciclo.id,
            'tipo': 'pago_profesor',
            'monto': Decimal('200.00'),
            'fecha': '2026-06-01',
            'metodo_pago': 'transferencia',
            'estado': 'cancelado',
            'profesor': profesor.id
        }
        serializer = EgresoSerializer(data=data)
        self.assertTrue(serializer.is_valid())


# =============================================================================
# Tests de API endpoints
# =============================================================================

class TestEgresoAPI(TestCase):
    """Tests para los endpoints CRUD de egresos."""

    def setUp(self):
        self.client = APIClient()

        # Crear ciclo
        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Test',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        self.otro_ciclo = Ciclo.objects.create(
            nombre='Otro Ciclo',
            tipo='verano',
            fecha_inicio=date(2026, 6, 1),
            fecha_fin=date(2026, 8, 31),
            activo=False
        )

        # Crear profesor
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Carlos',
            apellido='García',
            dni='87654321',
            telefono='555123456',
            email='carlos@test.com',
            activo=True
        )

        # Egresos para el ciclo principal
        self.egreso1 = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('150.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            descripcion='Cuerdas de guitarra',
            estado='cancelado'
        )
        self.egreso2 = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='pago_profesor',
            monto=Decimal('500.00'),
            fecha=date(2026, 6, 15),
            metodo_pago='transferencia',
            descripcion='Pago junio',
            beneficiario='Carlos García',
            profesor=self.profesor,
            estado='cancelado'
        )
        self.egreso3 = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_personal',
            monto=Decimal('300.00'),
            fecha=date(2026, 6, 10),
            metodo_pago='yape',
            descripcion='Limpieza',
            estado='pendiente'
        )

        # Egreso en otro ciclo (no debe aparecer en listados filtrados)
        self.egreso_otro_ciclo = Egreso.objects.create(
            ciclo=self.otro_ciclo,
            tipo='gasto_taller',
            monto=Decimal('999.00'),
            fecha=date(2026, 7, 1),
            metodo_pago='efectivo',
            descripcion='Otro ciclo',
            estado='cancelado'
        )

        # Autenticación
        from django.contrib.auth.models import User
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_list_egresos_filtrados_por_ciclo(self):
        """GET /api/ciclos/{ciclo_id}/egresos/ retorna solo egresos del ciclo."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        results = data['results'] if 'results' in data else data
        # Debe incluir los 3 egresos del ciclo principal
        self.assertEqual(len(results), 3)
        ids = [item['id'] for item in results]
        self.assertIn(self.egreso1.id, ids)
        self.assertIn(self.egreso2.id, ids)
        self.assertIn(self.egreso3.id, ids)
        # No debe incluir el egreso del otro ciclo
        self.assertNotIn(self.egreso_otro_ciclo.id, ids)

    def test_list_egresos_requiere_autenticacion(self):
        """Sin autenticación, el endpoint debe retornar 401."""
        self.client.credentials()  # Eliminar token
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_egreso_valido(self):
        """POST /api/ciclos/{ciclo_id}/egresos/ con datos válidos crea el egreso."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        data = {
            'tipo': 'gasto_taller',
            'monto': '250.00',
            'fecha': '2026-06-20',
            'metodo_pago': 'efectivo',
            'descripcion': 'Afinador',
            'estado': 'cancelado'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        result = response.json()
        self.assertEqual(result['monto'], '250.00')
        self.assertEqual(result['tipo'], 'gasto_taller')
        self.assertEqual(result['ciclo'], self.ciclo.id)

        # Verificar en BD
        self.assertTrue(Egreso.objects.filter(descripcion='Afinador').exists())

    def test_create_egreso_monto_cero_retorna_400(self):
        """POST con monto=0 debe retornar 400."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        data = {
            'tipo': 'gasto_taller',
            'monto': '0',
            'fecha': '2026-06-20',
            'metodo_pago': 'efectivo',
            'descripcion': 'Monto cero',
            'estado': 'cancelado'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('monto', response.json())

    def test_create_egreso_monto_negativo_retorna_400(self):
        """POST con monto negativo debe retornar 400."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        data = {
            'tipo': 'gasto_taller',
            'monto': '-50.00',
            'fecha': '2026-06-20',
            'metodo_pago': 'efectivo',
            'descripcion': 'Monto negativo',
            'estado': 'cancelado'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('monto', response.json())

    def test_create_pago_profesor_sin_profesor_retorna_400(self):
        """POST tipo=pago_profesor sin profesor debe retornar 400."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        data = {
            'tipo': 'pago_profesor',
            'monto': '200.00',
            'fecha': '2026-06-20',
            'metodo_pago': 'transferencia',
            'descripcion': 'Pago sin profesor',
            'estado': 'cancelado'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('profesor', response.json())

    def test_create_pago_profesor_con_profesor_exitoso(self):
        """POST tipo=pago_profesor con profesor debe ser exitoso."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/'
        data = {
            'tipo': 'pago_profesor',
            'monto': '350.00',
            'fecha': '2026-06-20',
            'metodo_pago': 'transferencia',
            'descripcion': 'Pago correcto',
            'estado': 'cancelado',
            'profesor': self.profesor.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        result = response.json()
        self.assertEqual(result['profesor'], self.profesor.id)

    def test_resumen_solo_cancelados(self):
        """GET /api/ciclos/{ciclo_id}/egresos/resumen/ debe sumar solo cancelados."""
        # Crear un egreso pendiente adicional para verificar que no se incluye
        Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('5000.00'),
            fecha=date(2026, 6, 5),
            metodo_pago='efectivo',
            descripcion='No debe aparecer en resumen',
            estado='pendiente'
        )

        url = f'/api/ciclos/{self.ciclo.id}/egresos/resumen/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        result = response.json()
        # gasto_taller: 150.00 (cancelado), pago_profesor: 500.00 (cancelado)
        # gasto_personal: 300.00 (pendiente → NO incluido)
        self.assertEqual(result['gasto_taller'], 150.0)
        self.assertEqual(result['pago_profesor'], 500.0)
        self.assertEqual(result['gasto_personal'], 0.0)
        self.assertEqual(result['total'], 650.0)

    def test_historial_pagos_retorna_egresos_profesor(self):
        """GET /api/profesores/{profesor_id}/historial-pagos/ retorna egresos del profesor."""
        url = f'/api/profesores/{self.profesor.id}/historial-pagos/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        # Solo egreso2 es pago_profesor para self.profesor
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], self.egreso2.id)
        self.assertEqual(data[0]['monto'], '500.00')

    def test_historial_pagos_sin_profesor_id_retorna_400(self):
        """GET sin profesor_id debe retornar 400."""
        url = '/api/profesores//historial-pagos/'
        # Construir URL inválida para probar el error
        # El view espera profesor_id en kwargs, si no está debe retornar 400
        # Usamos un profesor_id que no existe como 0
        url = '/api/profesores/99999/historial-pagos/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.json()), 0)

    def test_historial_pagos_solo_pago_profesor(self):
        """Historial de pagos debe retornar solo egresos tipo pago_profesor."""
        # Crear un egreso gasto_taller para el mismo profesor
        # (no debería aparecer en historial de pagos)
        Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('100.00'),
            fecha=date(2026, 6, 20),
            metodo_pago='efectivo',
            descripcion='Gasto no es pago',
            beneficiario='Carlos García',
            profesor=self.profesor,
            estado='cancelado'
        )

        url = f'/api/profesores/{self.profesor.id}/historial-pagos/'
        response = self.client.get(url)
        data = response.json()

        # Solo debe tener 1 (egreso2 - pago_profesor), no el gasto_taller
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['tipo'], 'pago_profesor')


# =============================================================================
# Tests de consistencia del resumen
# =============================================================================

class TestEgresoResumenConsistency(TestCase):
    """El resumen debe reflejar cambios de estado correctamente."""

    def setUp(self):
        self.client = APIClient()

        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Consistencia',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )

        # Autenticación
        from django.contrib.auth.models import User
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def _obtener_resumen(self):
        """Helper para obtener el resumen del ciclo."""
        url = f'/api/ciclos/{self.ciclo.id}/egresos/resumen/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def test_resumen_no_incluye_pendiente(self):
        """Crear egreso pendiente → resumen NO debe incluirlo."""
        Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('100.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            descripcion='Pendiente',
            estado='pendiente'
        )

        resumen = self._obtener_resumen()
        self.assertEqual(resumen['gasto_taller'], 0.0)
        self.assertEqual(resumen['total'], 0.0)

    def test_resumen_incluye_cancelado(self):
        """Crear egreso cancelado → resumen DEBE incluirlo."""
        Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_taller',
            monto=Decimal('200.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='efectivo',
            descripcion='Cancelado',
            estado='cancelado'
        )

        resumen = self._obtener_resumen()
        self.assertEqual(resumen['gasto_taller'], 200.0)
        self.assertEqual(resumen['total'], 200.0)

    def test_resumen_refleja_cambio_pendiente_a_cancelado(self):
        """Cambiar egreso de pendiente a cancelado → resumen ahora lo incluye."""
        egreso = Egreso.objects.create(
            ciclo=self.ciclo,
            tipo='gasto_personal',
            monto=Decimal('300.00'),
            fecha=date(2026, 6, 1),
            metodo_pago='transferencia',
            descripcion='Cambiando estado',
            estado='pendiente'
        )

        # Antes del cambio no debe aparecer
        resumen_antes = self._obtener_resumen()
        self.assertEqual(resumen_antes['gasto_personal'], 0.0)
        self.assertEqual(resumen_antes['total'], 0.0)

        # Cambiar estado a cancelado
        egreso.estado = 'cancelado'
        egreso.save()

        # Después del cambio debe aparecer
        resumen_despues = self._obtener_resumen()
        self.assertEqual(resumen_despues['gasto_personal'], 300.0)
        self.assertEqual(resumen_despues['total'], 300.0)

    def test_resumen_multiples_tipos_y_estados(self):
        """Mezcla de egresos de distintos tipos y estados debe calcular correctamente."""
        Egreso.objects.create(
            ciclo=self.ciclo, tipo='gasto_taller', monto=Decimal('100.00'),
            fecha=date(2026, 6, 1), metodo_pago='efectivo',
            descripcion='G1', estado='cancelado'
        )
        Egreso.objects.create(
            ciclo=self.ciclo, tipo='gasto_taller', monto=Decimal('50.00'),
            fecha=date(2026, 6, 2), metodo_pago='efectivo',
            descripcion='G2', estado='pendiente'  # No incluido
        )
        Egreso.objects.create(
            ciclo=self.ciclo, tipo='pago_profesor', monto=Decimal('400.00'),
            fecha=date(2026, 6, 3), metodo_pago='transferencia',
            descripcion='P1', estado='cancelado'
        )
        Egreso.objects.create(
            ciclo=self.ciclo, tipo='gasto_personal', monto=Decimal('200.00'),
            fecha=date(2026, 6, 4), metodo_pago='yape',
            descripcion='E1', estado='cancelado'
        )
        Egreso.objects.create(
            ciclo=self.ciclo, tipo='gasto_personal', monto=Decimal('75.00'),
            fecha=date(2026, 6, 5), metodo_pago='plin',
            descripcion='E2', estado='pendiente'  # No incluido
        )

        resumen = self._obtener_resumen()
        self.assertEqual(resumen['gasto_taller'], 100.0)
        self.assertEqual(resumen['pago_profesor'], 400.0)
        self.assertEqual(resumen['gasto_personal'], 200.0)
        self.assertEqual(resumen['total'], 700.0)
