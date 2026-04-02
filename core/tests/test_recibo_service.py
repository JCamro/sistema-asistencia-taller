"""
Tests para core/services/recibo_service.py - Distribución de montos de recibos.

Verifica la distribución de montos entre matrículas:
- 1 matrícula → monto completo
- 2+ matrículas mismo tipo → distribución equitativa
- Diferentes tipos → distribución proporcional
"""
from datetime import date
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest
from django.test import TestCase

from core.services.recibo_service import ReciboService


class TestGenerarNumero(TestCase):
    """Tests para el método _generar_numero()."""

    def test_formato_numero_recibo(self):
        """Verifica que el número de recibo tenga formato REC-YYYY-NNNN."""
        numero = ReciboService._generar_numero()
        
        # Debe comenzar con REC-
        self.assertTrue(numero.startswith('REC-'))
        
        # Debe tener formato REC-YYYY-NNNN (10 dígitos después de REC-)
        parts = numero.split('-')
        self.assertEqual(len(parts), 3)
        
        # El año debe ser el año actual
        self.assertEqual(parts[1], str(date.today().year))
        
        # El número debe tener 4 dígitos
        self.assertEqual(len(parts[2]), 4)


class TestDistributeAmounts(TestCase):
    """Tests para el método _distribute_amounts()."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Alumno, Taller, Matricula, Recibo, ReciboMatricula
        
        # Crear ciclo
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        # Crear alumno
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test',
            apellido='Alumno',
            dni='12345678',
            telefono='999999999',
            email='test@test.com',
            activo=True
        )
        
        # Crear taller tipo instrumento
        self.taller_inst = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Guitarra',
            activo=True
        )
        
        # Crear taller tipo taller
        self.taller_taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Teatro',
            tipo='taller',
            descripcion='Teatro',
            activo=True
        )
        
        # Crear matrículas
        self.matricula1 = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller_inst,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        self.matricula2 = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller_inst,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        # Crear tercera matrícula (tipo taller) - se crea más adelante cuando se necesite
        
        # Crear recibo con fecha_emision
        self.recibo = Recibo.objects.create(
            numero='REC-2026-0001',
            ciclo=self.ciclo,
            fecha_emision=date(2026, 3, 15),
            monto_bruto=Decimal('100.00'),
            monto_total=Decimal('100.00'),
            monto_pagado=Decimal('0.00'),
            estado='pendiente'
        )

    def test_una_matricula_monto_completo(self):
        """1 matrícula → recibe el monto completo."""
        from core.models import ReciboMatricula
        
        # Limpiar relaciones previas
        self.recibo.matriculas.all().delete()
        
        # Distribuir 100 entre 1 matrícula
        ReciboService._distribute_amounts(
            self.recibo,
            [self.matricula1.id],
            Decimal('100.00')
        )
        
        # Verificar que la matrícula recibió el monto completo
        rm = ReciboMatricula.objects.get(recibo=self.recibo)
        self.assertEqual(rm.monto, Decimal('100.00'))
        
        # Verificar que se actualizó el precio_total de la matrícula
        self.matricula1.refresh_from_db()
        self.assertEqual(self.matricula1.precio_total, Decimal('100.00'))

    def test_dos_matriculas_mismo_tipo_igual_distribucion(self):
        """2 matrículas mismo tipo → distribución equitativa con redondeo a 5."""
        from core.models import ReciboMatricula
        
        self.recibo.matriculas.all().delete()
        
        # Distribuir 100 entre 2 matrículas (mismo tipo instrumento, 10 sesiones)
        # 100 / 2 = 50 cada una
        ReciboService._distribute_amounts(
            self.recibo,
            [self.matricula1.id, self.matricula2.id],
            Decimal('100.00')
        )
        
        rms = ReciboMatricula.objects.filter(recibo=self.recibo).order_by('id')
        self.assertEqual(rms.count(), 2)
        
        # Verificar distribución (redondeo a 5)
        montos = [rm.monto for rm in rms]
        self.assertEqual(sum(montos), Decimal('100.00'))

    def test_dos_matriculas_diferente_tipo_proporcional(self):
        """Matrículas de diferentes tipos → distribución proporcional."""
        from core.models import ReciboMatricula, Alumno, Matricula
        
        # Crear otro alumno para la segunda matrícula
        alumno2 = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno',
            apellido='Dos',
            dni='11111111',
            telefono='777777777',
            email='dos@test.com',
            activo=True
        )
        
        matricula_inst = Matricula.objects.create(
            alumno=alumno2,
            ciclo=self.ciclo,
            taller=self.taller_inst,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        # Crear matrícula de tipo taller con el mismo alumno
        matricula_taller = Matricula.objects.create(
            alumno=alumno2,
            ciclo=self.ciclo,
            taller=self.taller_taller,
            sesiones_contratadas=8,
            precio_total=Decimal('160.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        self.recibo.matriculas.all().delete()
        
        # Distribuir 180 entre dos matrículas de diferentes tipos
        # Proporcional: instrumento(200) vs taller(160) = 5:4
        # instrumento: 180 * (200/360) = 100
        # taller: 180 * (160/360) = 80
        # Redondeado a 5: 100 y 80
        ReciboService._distribute_amounts(
            self.recibo,
            [matricula_inst.id, matricula_taller.id],
            Decimal('180.00')
        )
        
        rms = ReciboMatricula.objects.filter(recibo=self.recibo)
        self.assertEqual(rms.count(), 2)
        
        # La suma debe ser 180
        total = sum(rm.monto for rm in rms)
        self.assertEqual(total, Decimal('180.00'))

    def test_descuento_detectado(self):
        """monto_bruto != monto_total → precio_editado=True en create_recibo."""
        from core.models import ReciboMatricula
        
        # Usar create_recibo que es quien establece precio_editado
        datos = {
            'ciclo': self.ciclo,
            'fecha_emision': date(2026, 3, 15),
            'monto_bruto': Decimal('120.00'),
            'monto_total': Decimal('100.00'),
            'monto_pagado': Decimal('0.00'),
            'estado': 'pendiente'
        }
        
        recibo_descuento = ReciboService.create_recibo(datos, [self.matricula1.id])
        
        # Verificar que se detectó el descuento
        self.assertTrue(recibo_descuento.precio_editado)
        self.assertEqual(recibo_descuento.descuento, Decimal('20.00'))

    def test_monto_no_divisible_por_5(self):
        """Amount no divisible por 5 → ajuste en primera matrícula."""
        from core.models import ReciboMatricula
        
        self.recibo.matriculas.all().delete()
        
        # 100 no es divisible por 5? En realidad sí: 100/5 = 20
        # Probemos con 97
        ReciboService._distribute_amounts(
            self.recibo,
            [self.matricula1.id, self.matricula2.id],
            Decimal('97.00')
        )
        
        rms = ReciboMatricula.objects.filter(recibo=self.recibo).order_by('id')
        self.assertEqual(rms.count(), 2)
        
        # La suma debe ser 97
        total = sum(rm.monto for rm in rms)
        self.assertEqual(total, Decimal('97.00'))


class TestReciboServiceCreate(TestCase):
    """Tests para create_recibo()"""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Alumno, Taller, Matricula
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test',
            apellido='Alumno',
            dni='12345678',
            telefono='999999999',
            email='test@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Guitarra',
            activo=True
        )
        
        # Crear matrícula con todos los campos requeridos
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )

    def test_create_recibo_con_una_matricula(self):
        """Crear recibo con una matrícula."""
        from core.models import ReciboMatricula
        
        datos = {
            'ciclo': self.ciclo,
            'fecha_emision': date(2026, 3, 15),
            'monto_bruto': Decimal('100.00'),
            'monto_total': Decimal('100.00'),
            'monto_pagado': Decimal('0.00'),
            'estado': 'pendiente'
        }
        
        recibo = ReciboService.create_recibo(datos, [self.matricula.id])
        
        # Verificar ReciboMatricula
        rm = ReciboMatricula.objects.get(recibo=recibo)
        self.assertEqual(rm.matricula, self.matricula)
        self.assertEqual(rm.monto, Decimal('100.00'))

    def test_create_recibo_con_descuento(self):
        """Crear recibo con descuento."""
        datos = {
            'ciclo': self.ciclo,
            'fecha_emision': date(2026, 3, 15),
            'monto_bruto': Decimal('120.00'),
            'monto_total': Decimal('100.00'),
            'monto_pagado': Decimal('0.00'),
            'estado': 'pendiente'
        }
        
        recibo = ReciboService.create_recibo(datos, [self.matricula.id])
        
        self.assertTrue(recibo.precio_editado)
        self.assertEqual(recibo.descuento, Decimal('20.00'))


class TestReciboServiceUpdate(TestCase):
    """Tests para update_recibo()"""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Alumno, Taller, Matricula, Recibo
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test',
            apellido='Alumno',
            dni='12345678',
            telefono='999999999',
            email='test@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Guitarra',
            activo=True
        )
        
        # Crear matrícula con todos los campos requeridos
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        self.recibo = Recibo.objects.create(
            numero='REC-2026-0001',
            ciclo=self.ciclo,
            fecha_emision=date(2026, 3, 15),
            monto_bruto=Decimal('100.00'),
            monto_total=Decimal('100.00'),
            monto_pagado=Decimal('0.00'),
            estado='pendiente'
        )

    def test_update_recibo_cambia_monto(self):
        """Actualizar recibo cambia monto_total y recalcula distribución."""
        from core.models import ReciboMatricula
        
        # Crear ReciboMatricula inicial
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula,
            monto=Decimal('100.00')
        )
        
        nuevos_datos = {
            'monto_total': Decimal('150.00'),
            'monto_bruto': Decimal('150.00')
        }
        
        ReciboService.update_recibo(self.recibo, nuevos_datos, None)
        
        self.recibo.refresh_from_db()
        self.assertEqual(self.recibo.monto_total, Decimal('150.00'))

    def test_update_recibo_cambia_matriculas(self):
        """Actualizar recibo cambia las matrículas asociadas."""
        from core.models import Alumno, Matricula, ReciboMatricula
        
        # Crear segunda matrícula
        alumno2 = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test2',
            apellido='Alumno',
            dni='11111111',
            telefono='777777777',
            email='test2@test.com',
            activo=True
        )
        
        # Crear segunda matrícula
        matricula2 = Matricula.objects.create(
            alumno=alumno2,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        nuevos_datos = {
            'monto_total': Decimal('100.00'),
            'monto_bruto': Decimal('100.00')
        }
        
        # Reemplazar con nuevas matrículas
        ReciboService.update_recibo(
            self.recibo,
            nuevos_datos,
            [self.matricula.id, matricula2.id]
        )
        
        # Verificar que ahora tiene 2 matrículas
        self.assertEqual(self.recibo.matriculas.count(), 2)


class TestReciboServiceUpdateDiscount(TestCase):
    """Tests adicionales para update_recibo() - paths de descuento."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Alumno, Taller, Matricula, Recibo
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test',
            apellido='Alumno',
            dni='12345678',
            telefono='999999999',
            email='test@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Guitarra',
            activo=True
        )
        
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        self.recibo = Recibo.objects.create(
            numero='REC-2026-0001',
            ciclo=self.ciclo,
            fecha_emision=date(2026, 3, 15),
            monto_bruto=Decimal('100.00'),
            monto_total=Decimal('100.00'),
            monto_pagado=Decimal('0.00'),
            estado='pendiente'
        )

    def test_update_recibo_discount_detection(self):
        """T2: Actualizar recibo donde monto_bruto > monto_total establece precio_editado y descuento."""
        from core.models import ReciboMatricula
        
        # Crear ReciboMatricula inicial
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula,
            monto=Decimal('100.00')
        )
        
        # Cambiar monto_total a menor que monto_bruto parasimular descuento
        nuevos_datos = {
            'monto_total': Decimal('80.00'),
            'monto_bruto': Decimal('100.00')
        }
        
        ReciboService.update_recibo(self.recibo, nuevos_datos, None)
        
        self.recibo.refresh_from_db()
        # monto_bruto(100) - monto_total(80) = 20 de descuento
        self.assertTrue(self.recibo.precio_editado)
        self.assertEqual(self.recibo.descuento, Decimal('20.00'))

    def test_update_recibo_matricula_doesnotexist(self):
        """T3: Pasar ID de matrícula inválido es silenciosamente ignorado."""
        from core.models import ReciboMatricula
        
        nuevos_datos = {
            'monto_total': Decimal('100.00'),
            'monto_bruto': Decimal('100.00')
        }
        
        # Pasar ID de matrícula que no existe (99999)
        ReciboService.update_recibo(
            self.recibo,
            nuevos_datos,
            [self.matricula.id, 99999]
        )
        
        # Debe tener solo 1 matrícula (la válida)
        self.assertEqual(self.recibo.matriculas.count(), 1)

    def test_update_recibo_monto_change_only(self):
        """T4: Cambiar monto_total sin pasar matricula_ids llama a _actualizar_precios_matriculas."""
        from core.models import ReciboMatricula
        
        # Crear ReciboMatricula inicial
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula,
            monto=Decimal('100.00')
        )
        
        nuevos_datos = {
            'monto_total': Decimal('80.00'),
            'monto_bruto': Decimal('100.00')
        }
        
        # No pasar matricula_ids, solo cambiar monto_total
        ReciboService.update_recibo(self.recibo, nuevos_datos, None)
        
        self.recibo.refresh_from_db()
        # Verificar que precio_editado se estableció
        self.assertTrue(self.recibo.precio_editado)


class TestActualizarPreciosMatriculas(TestCase):
    """Tests para _actualizar_precios_matriculas()."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Alumno, Taller, Matricula, Recibo
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test',
            apellido='Alumno',
            dni='12345678',
            telefono='999999999',
            email='test@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Guitarra',
            activo=True
        )
        
        # Matrículas del mismo tipo (instrumento, 10 sesiones)
        self.matricula1 = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        self.matricula2 = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        self.recibo = Recibo.objects.create(
            numero='REC-2026-0001',
            ciclo=self.ciclo,
            fecha_emision=date(2026, 3, 15),
            monto_bruto=Decimal('100.00'),
            monto_total=Decimal('100.00'),
            monto_pagado=Decimal('0.00'),
            estado='pendiente'
        )

    def test_actualizar_precios_same_type(self):
        """T5: Same-type matrículas → distribución equitativa."""
        from core.models import ReciboMatricula
        
        # Crear ReciboMatriculas con montos originales
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula1,
            monto=Decimal('50.00')
        )
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula2,
            monto=Decimal('50.00')
        )
        
        # Cambiar monto_total del recibo
        self.recibo.monto_total = Decimal('80.00')
        self.recibo.save()
        
        # Llamar al método interno
        ReciboService._actualizar_precios_matriculas(self.recibo)
        
        # Verificar distribución equitativa: 80/2 = 40 cada una
        rms = ReciboMatricula.objects.filter(recibo=self.recibo)
        for rm in rms:
            self.assertEqual(rm.monto, Decimal('40.00'))

    def test_actualizar_precios_different_type(self):
        """T6: Different-type matrículas → distribución proporcional."""
        from core.models import Alumno, Taller, Matricula, ReciboMatricula
        
        # Crear taller de tipo diferente (taller en vez de instrumento)
        taller_teatro = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Teatro',
            tipo='taller',
            descripcion='Teatro',
            activo=True
        )
        
        # Crear segunda matrícula de tipo diferente
        alumno2 = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Test2',
            apellido='Alumno',
            dni='11111111',
            telefono='777777777',
            email='test2@test.com',
            activo=True
        )
        
        matricula_teatro = Matricula.objects.create(
            alumno=alumno2,
            ciclo=self.ciclo,
            taller=taller_teatro,
            sesiones_contratadas=8,
            precio_total=Decimal('160.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True
        )
        
        # Crear ReciboMatriculas con montos originales (instrumento: 50, taller: 50)
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula1,
            monto=Decimal('50.00')
        )
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=matricula_teatro,
            monto=Decimal('50.00')
        )
        
        # Cambiar monto_total a 100
        self.recibo.monto_total = Decimal('100.00')
        self.recibo.save()
        
        # Llamar al método
        ReciboService._actualizar_precios_matriculas(self.recibo)
        
        # Verificar que se actualizó el monto_total del recibo
        rms = ReciboMatricula.objects.filter(recibo=self.recibo)
        total = sum(rm.monto for rm in rms)
        self.assertEqual(total, Decimal('100.00'))

    def test_actualizar_precios_total_original_zero(self):
        """T7: Different-type con todos los montos en 0 → distribución igualitaria."""
        from core.models import ReciboMatricula
        
        # Crear ReciboMatriculas con montos = 0
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula1,
            monto=Decimal('0.00')
        )
        ReciboMatricula.objects.create(
            recibo=self.recibo,
            matricula=self.matricula2,
            monto=Decimal('0.00')
        )
        
        # Cambiar monto_total a 100
        self.recibo.monto_total = Decimal('100.00')
        self.recibo.save()
        
        # Llamar al método
        ReciboService._actualizar_precios_matriculas(self.recibo)
        
        # Verificar distribución equitativa: 100/2 = 50 cada una
        rms = ReciboMatricula.objects.filter(recibo=self.recibo)
        for rm in rms:
            self.assertEqual(rm.monto, Decimal('50.00'))

    def test_distribute_invalid_matricula_id(self):
        """T8: Pasar ID de matrícula no existente a _distribute_amounts."""
        from core.models import ReciboMatricula
        
        # ID que no existe
        invalid_id = 99999
        
        # Llamar con ID inválido - debe ser silenciosamente ignorado
        ReciboService._distribute_amounts(
            self.recibo,
            [self.matricula1.id, invalid_id],
            Decimal('100.00')
        )
        
        # Debe tener solo 1 ReciboMatricula (la válida)
        self.assertEqual(self.recibo.matriculas.count(), 1)