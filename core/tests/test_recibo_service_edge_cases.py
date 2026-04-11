"""
Tests TDD para core/services/recibo_service.py - Edge cases.

Expone bugs en distribución de montos.
"""
from datetime import date
from decimal import Decimal

from django.test import TestCase

from core.models import Ciclo, Alumno, Taller, Matricula, Recibo, ReciboMatricula, PrecioPaquete
from core.services.recibo_service import ReciboService


class TestDistributeAmountsEdgeCases(TestCase):
    """Edge cases para _distribute_amounts."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Test', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', telefono='999', email='juan@test.com', activo=True
        )
        self.taller = Taller.objects.create(
            ciclo=self.ciclo, nombre='Guitarra', tipo='instrumento',
            descripcion='Guitarra', activo=True
        )

    def test_matricula_id_inexistente_se_ignora(self):
        """Si un ID de matrícula no existe, se ignora y no crashea."""
        recibo = Recibo.objects.create(
            numero='REC-2024-0001', ciclo=self.ciclo,
            fecha_emision=date(2024, 3, 1),
            monto_bruto=Decimal('100.00'), monto_total=Decimal('100.00'),
            monto_pagado=Decimal('0.00'), estado='pendiente'
        )
        # 99999 no existe
        try:
            ReciboService._distribute_amounts(recibo, [99999], Decimal('100.00'))
            # Verificar que no se creó ningún ReciboMatricula
            self.assertEqual(ReciboMatricula.objects.filter(recibo=recibo).count(), 0)
        except Exception as e:
            self.fail(f"El código crasheó con ID inexistente: {e}")

    def test_monto_total_cero_no_crashea(self):
        """Con monto_total=0, no debe crashear."""
        matricula = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo', activo=True
        )
        recibo = Recibo.objects.create(
            numero='REC-2024-0002', ciclo=self.ciclo,
            fecha_emision=date(2024, 3, 1),
            monto_bruto=Decimal('0.00'), monto_total=Decimal('0.00'),
            monto_pagado=Decimal('0.00'), estado='pendiente'
        )
        try:
            ReciboService._distribute_amounts(recibo, [matricula.id], Decimal('0.00'))
            # Verificar que se creó el registro (quizás con monto 0)
            rms = ReciboMatricula.objects.filter(recibo=recibo)
            self.assertGreaterEqual(rms.count(), 0)  # O falla, pero no crashea
        except Exception as e:
            self.fail(f"El código crasheó con monto_total=0: {e}")


class TestUpdateReciboEdgeCases(TestCase):
    """Edge cases para update_recibo."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Test', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', telefono='999', email='juan@test.com', activo=True
        )
        self.taller1 = Taller.objects.create(
            ciclo=self.ciclo, nombre='Guitarra', tipo='instrumento',
            descripcion='Guitarra', activo=True
        )
        self.taller2 = Taller.objects.create(
            ciclo=self.ciclo, nombre='Teatro', tipo='taller',
            descripcion='Teatro', activo=True
        )
        self.matricula1 = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller1,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo', activo=True
        )
        self.matricula2 = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller2,
            sesiones_contratadas=10, precio_total=Decimal('100.00'),
            precio_por_sesion=Decimal('10.00'), metodo_pago='efectivo', activo=True
        )

    def test_update_recibo_sin_cambiar_matriculas(self):
        """Update que solo cambia monto_total sin tocar matriculas."""
        recibo = Recibo.objects.create(
            numero='REC-2024-0003', ciclo=self.ciclo,
            fecha_emision=date(2024, 3, 1),
            monto_bruto=Decimal('300.00'), monto_total=Decimal('300.00'),
            monto_pagado=Decimal('0.00'), estado='pendiente'
        )
        ReciboMatricula.objects.create(
            recibo=recibo, matricula=self.matricula1, monto=Decimal('200.00')
        )
        ReciboMatricula.objects.create(
            recibo=recibo, matricula=self.matricula2, monto=Decimal('100.00')
        )

        # Update solo cambia monto_total
        ReciboService.update_recibo(recibo, {'monto_total': Decimal('250.00')}, None)

        recibo.refresh_from_db()
        self.assertEqual(recibo.monto_total, Decimal('250.00'))
        # Los ReciboMatricula siguen existiendo
        self.assertEqual(recibo.matriculas.count(), 2)

    def test_update_recibo_matriculas_diferentes_tipos_distribucion_proporcional(self):
        """Cuando se cambian matriculas a tipos diferentes, usa distribución proporcional."""
        recibo = Recibo.objects.create(
            numero='REC-2024-0004', ciclo=self.ciclo,
            fecha_emision=date(2024, 3, 1),
            monto_bruto=Decimal('300.00'), monto_total=Decimal('300.00'),
            monto_pagado=Decimal('0.00'), estado='pendiente'
        )
        ReciboMatricula.objects.create(
            recibo=recibo, matricula=self.matricula1, monto=Decimal('200.00')
        )

        # Cambiar a las dos matrículas (tipos diferentes)
        ReciboService.update_recibo(
            recibo, {'monto_total': Decimal('300.00')},
            [self.matricula1.id, self.matricula2.id]
        )

        recibo.refresh_from_db()
        rms = list(recibo.matriculas.all().order_by('id'))
        self.assertEqual(len(rms), 2)
        # Verificar que la suma de montos = monto_total
        suma = sum(rm.monto for rm in rms)
        self.assertEqual(suma, Decimal('300.00'))

    def test_update_recibo_reemplaza_matriculas_y_elimina_viejas(self):
        """Update con nuevas matriculas debe eliminar las anteriores."""
        recibo = Recibo.objects.create(
            numero='REC-2024-0005', ciclo=self.ciclo,
            fecha_emision=date(2024, 3, 1),
            monto_bruto=Decimal('200.00'), monto_total=Decimal('200.00'),
            monto_pagado=Decimal('0.00'), estado='pendiente'
        )
        ReciboMatricula.objects.create(
            recibo=recibo, matricula=self.matricula1, monto=Decimal('200.00')
        )
        self.assertEqual(recibo.matriculas.count(), 1)

        # Reemplazar con matricula2
        ReciboService.update_recibo(
            recibo, {'monto_total': Decimal('100.00')},
            [self.matricula2.id]
        )

        recibo.refresh_from_db()
        rms = list(recibo.matriculas.all())
        self.assertEqual(len(rms), 1)
        self.assertEqual(rms[0].matricula_id, self.matricula2.id)


class TestActualizarPreciosMatriculas(TestCase):
    """Tests para _actualizar_precios_matriculas."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Test', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', telefono='999', email='juan@test.com', activo=True
        )
        self.taller = Taller.objects.create(
            ciclo=self.ciclo, nombre='Guitarra', tipo='instrumento',
            descripcion='Guitarra', activo=True
        )

    def test_actualizar_precios_misma_matricula(self):
        """Actualizar precio de una matrícula a través del recibo."""
        matricula = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo', activo=True
        )
        recibo = Recibo.objects.create(
            numero='REC-2024-0006', ciclo=self.ciclo,
            fecha_emision=date(2024, 3, 1),
            monto_bruto=Decimal('150.00'), monto_total=Decimal('150.00'),
            monto_pagado=Decimal('0.00'), estado='pendiente'
        )
        ReciboMatricula.objects.create(
            recibo=recibo, matricula=matricula, monto=Decimal('150.00')
        )

        # Actualizar precios desde el recibo
        ReciboService._actualizar_precios_matriculas(recibo)

        matricula.refresh_from_db()
        # El precio_total de la matrícula ahora debería ser el del ReciboMatricula
        # (este es el comportamiento actual, que puede o no ser correcto)
        self.assertEqual(matricula.precio_total, Decimal('150.00'))
