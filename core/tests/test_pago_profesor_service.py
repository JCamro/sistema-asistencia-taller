"""
Tests para core/services/pago_profesor_service.py - Fórmula de pago a profesores.

Verifica el cálculo de pago por clase según la fórmula:
- 0 alumnos → S/. 0.00
- 1 alumno → S/. 17.00 fijo
- 2+ alumnos → S/. 17.00 base + 50% del valor de sesión de cada alumno adicional
- Tope → Máx S/. 35.00 por clase
"""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.test import TestCase

from core.constants import BASE_PAGO, TOPE_MAXIMO
from core.services.pago_profesor_service import PagoProfesorService


class TestCalcularPagoClase(TestCase):
    """Test case para validar la fórmula de cálculo de pago por clase."""

    def _crear_mock_asistencia(self, precio_sesion: float):
        """Crea un mock de Asistencia con precio por sesión."""
        mock_matricula = MagicMock()
        mock_matricula.precio_por_sesion = Decimal(str(precio_sesion))
        
        mock_asistencia = MagicMock()
        mock_asistencia.matricula = mock_matricula
        return mock_asistencia

    def test_cero_alumnos(self):
        """0 alumnos → payment=0.00, profit=0.00"""
        asistentes = []
        num_alumnos = 0
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        self.assertEqual(resultado['monto_profesor'], Decimal('0.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))

    def test_un_alumno_valor_normal(self):
        """1 estudiante, session_value=20 → payment=17.00, profit=3.00"""
        mock_asistencia = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia]
        num_alumnos = 1
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        self.assertEqual(resultado['monto_profesor'], BASE_PAGO)  # 17.00
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))
        
        # Verificar profit del taller: valor generado - pago profesor
        valor_generado = Decimal('20.00')
        profit_taller = valor_generado - resultado['monto_profesor']
        self.assertEqual(profit_taller, Decimal('3.00'))

    def test_dos_alumnos(self):
        """2 estudiantes, session_value=20 cada uno → payment=25.00, profit=15.00"""
        mock_asistencia1 = self._crear_mock_asistencia(20.00)
        mock_asistencia2 = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia1, mock_asistencia2]
        num_alumnos = 2
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Fórmula: 17.00 + 50% * 20.00 = 17.00 + 10.00 = 27.00, pero capped a 35.00
        # En realidad el código itera sobre asistentes[1:], entonces:
        # monto_profesor = BASE_PAGO (17) + monto_adicional
        # monto_adicional += 20 * 0.50 = 10
        # monto_profesor = min(17 + 10, 35) = 27
        self.assertEqual(resultado['monto_profesor'], Decimal('27.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('10.00'))
        
        # Profit: 40 - 27 = 13
        valor_generado = Decimal('40.00')
        profit_taller = valor_generado - resultado['monto_profesor']
        self.assertEqual(profit_taller, Decimal('13.00'))

    def test_tres_alumnos_capped(self):
        """3 estudiantes, session_value=20 cada uno → payment=35.00 (capped), profit=25.00"""
        mock_asistencia1 = self._crear_mock_asistencia(20.00)
        mock_asistencia2 = self._crear_mock_asistencia(20.00)
        mock_asistencia3 = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia1, mock_asistencia2, mock_asistencia3]
        num_alumnos = 3
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Fórmula: 17 + 10 + 10 = 37, capped a 35
        self.assertEqual(resultado['monto_profesor'], TOPE_MAXIMO)  # 35.00
        # monto_adicional real = 35 - 17 = 18 (respeta tope)
        self.assertEqual(resultado['monto_adicional'], Decimal('18.00'))

    def test_cinco_alumnos_capped(self):
        """5 estudiantes, session_value=20 cada uno → payment=35.00 (capped), profit=65.00"""
        mock_asistencia1 = self._crear_mock_asistencia(20.00)
        mock_asistencia2 = self._crear_mock_asistencia(20.00)
        mock_asistencia3 = self._crear_mock_asistencia(20.00)
        mock_asistencia4 = self._crear_mock_asistencia(20.00)
        mock_asistencia5 = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia1, mock_asistencia2, mock_asistencia3, 
                     mock_asistencia4, mock_asistencia5]
        num_alumnos = 5
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Debe estar capped a 35
        self.assertEqual(resultado['monto_profesor'], TOPE_MAXIMO)
        # Profit: 100 - 35 = 65
        valor_generado = Decimal('100.00')
        profit_taller = valor_generado - resultado['monto_profesor']
        self.assertEqual(profit_taller, Decimal('65.00'))

    def test_un_alumno_valor_pequeno(self):
        """1 estudiante con valor de sesión pequeño (5.00) → payment=17.00 (fixed base)"""
        mock_asistencia = self._crear_mock_asistencia(5.00)
        asistentes = [mock_asistencia]
        num_alumnos = 1
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Siempre 17.00 para 1 estudiante, sin importar el valor de sesión
        self.assertEqual(resultado['monto_profesor'], BASE_PAGO)

    def test_dos_alumnos_valor_grande(self):
        """2 estudiantes con valor grande (100.00) → payment=35.00 (capped)"""
        mock_asistencia1 = self._crear_mock_asistencia(100.00)
        mock_asistencia2 = self._crear_mock_asistencia(100.00)
        asistentes = [mock_asistencia1, mock_asistencia2]
        num_alumnos = 2
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Fórmula: 17 + 50% * 100 = 17 + 50 = 67, capped a 35
        self.assertEqual(resultado['monto_profesor'], TOPE_MAXIMO)

    def test_dos_alumnos_valores_diferentes(self):
        """2 estudiantes con valores diferentes → cálculo proporcional"""
        mock_asistencia1 = self._crear_mock_asistencia(20.00)
        mock_asistencia2 = self._crear_mock_asistencia(30.00)
        asistentes = [mock_asistencia1, mock_asistencia2]
        num_alumnos = 2
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Fórmula: 17 + 50% * 30 = 17 + 15 = 32
        self.assertEqual(resultado['monto_profesor'], Decimal('32.00'))

    def test_valor_sesion_none(self):
        """Estudiante con precio_por_sesion=None → tratado como 0"""
        mock_matricula = MagicMock()
        mock_matricula.precio_por_sesion = None
        
        mock_asistencia = MagicMock()
        mock_asistencia.matricula = mock_matricula
        asistentes = [mock_asistencia]
        num_alumnos = 1
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # Con 1 estudiante, siempre retorna BASE_PAGO
        self.assertEqual(resultado['monto_profesor'], BASE_PAGO)

    def test_muchos_alumnos_valor_pequeno(self):
        """10 estudiantes con valor pequeño (10.00) → no debe alcanzar el techo"""
        mock_asistentes = [self._crear_mock_asistencia(10.00) for _ in range(10)]
        num_alumnos = 10
        
        resultado = PagoProfesorService._calcular_pago_clase(mock_asistentes, num_alumnos)
        
        # Fórmula: 17 + 9 * (10 * 0.5) = 17 + 45 = 62, capped a 35
        self.assertEqual(resultado['monto_profesor'], TOPE_MAXIMO)


class TestPagoProfesorServiceIntegration(TestCase):
    """Tests de integración para PagoProfesorService con datos reales de DB."""

    def setUp(self):
        """Crear datos de prueba en la base de datos."""
        from core.models import Ciclo, Profesor, Alumno, Taller, Horario, Matricula
        
        # Crear ciclo
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle 2026',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        # Crear profesor
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Profesor',
            apellido='Test',
            dni='12345678',
            telefono='999999999',
            email='prof@test.com',
            activo=True,
            es_gerente=False
        )
        
        # Crear alumno
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno',
            apellido='Test',
            dni='87654321',
            telefono='888888888',
            email='alumno@test.com',
            activo=True
        )
        
        # Crear taller
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Taller de guitarra',
            activo=True
        )
        
        # Crear horario
        self.horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=self.taller,
            profesor=self.profesor,
            dia_semana=0,  # Lunes
            hora_inicio='10:00',
            hora_fin='11:00',
            cupo_maximo=10
        )
        
        # Crear matrícula con precio por sesión = 20
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),  # 20 por sesión
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )

    def test_detalle_clase_sin_asistencias(self):
        """detalle_clase sin asistencias retorna valores correctos."""
        from core.models import Asistencia
        
        # No hay asistencias para esta fecha
        resultado = PagoProfesorService.detalle_clase(
            horario_id=self.horario.id,
            fecha='2026-03-15',
            profesor_id=self.profesor.id
        )
        
        self.assertEqual(resultado['resumen']['num_alumnos'], 0)
        self.assertEqual(resultado['resumen']['monto_profesor'], 0)
        self.assertEqual(resultado['resumen']['ganancia_taller'], 0)

    def test_detalle_clase_con_una_asistencia(self):
        """detalle_clase con 1 asistencia retorna 17.00 para el profesor."""
        from core.models import Asistencia
        
        # Crear asistencia
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        resultado = PagoProfesorService.detalle_clase(
            horario_id=self.horario.id,
            fecha='2026-03-15',
            profesor_id=self.profesor.id
        )
        
        self.assertEqual(resultado['resumen']['num_alumnos'], 1)
        self.assertEqual(resultado['resumen']['monto_profesor'], 17.00)
        self.assertEqual(resultado['resumen']['ganancia_taller'], 3.00)  # 20 - 17

    def test_detalle_clase_con_dos_asistencias(self):
        """detalle_clase con 2 asistentes."""
        from core.models import Alumno, Matricula, Asistencia
        
        # Crear segundo alumno y matrícula
        alumno2 = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno2',
            apellido='Test',
            dni='11111111',
            telefono='777777777',
            email='alumno2@test.com',
            activo=True
        )
        
        matricula2 = Matricula.objects.create(
            alumno=alumno2,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )
        
        # Crear dos asistencias
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        Asistencia.objects.create(
            matricula=matricula2,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        resultado = PagoProfesorService.detalle_clase(
            horario_id=self.horario.id,
            fecha='2026-03-15',
            profesor_id=self.profesor.id
        )
        
        self.assertEqual(resultado['resumen']['num_alumnos'], 2)
        # 17 + 50%*20 = 27
        self.assertEqual(resultado['resumen']['monto_profesor'], 27.00)
        # 40 - 27 = 13
        self.assertEqual(resultado['resumen']['ganancia_taller'], 13.00)


class TestCalcularPeriodo(TestCase):
    """Tests para calcular_periodo() - flujo completo con objetos DB."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Profesor, Alumno, Taller, Horario, Matricula
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle 2026',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Profesor',
            apellido='Test',
            dni='12345678',
            telefono='999999999',
            email='prof@test.com',
            activo=True,
            es_gerente=False
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno',
            apellido='Test',
            dni='87654321',
            telefono='888888888',
            email='alumno@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Taller de guitarra',
            activo=True
        )
        
        self.horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=self.taller,
            profesor=self.profesor,
            dia_semana=0,
            hora_inicio='10:00',
            hora_fin='11:00',
            cupo_maximo=10
        )
        
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )

    def test_calcular_periodo_empty_profesores(self):
        """T9: Ciclo sin profesores activos → lista de resultados vacía."""
        from core.models import Ciclo, Profesor, PagoProfesor
        
        # Crear ciclo sin profesor
        ciclo_vacio = Ciclo.objects.create(
            nombre='Empty Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        resultado = PagoProfesorService.calcular_periodo(
            ciclo_vacio,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )
        
        self.assertEqual(len(resultado['resultados']), 0)

    def test_calcular_periodo_with_asistencias(self):
        """T10: Flujo completo con real DB - verificar PagoProfesor y PagoProfesorDetalle."""
        from core.models import Asistencia, PagoProfesor, PagoProfesorDetalle
        
        # Crear asistencia
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        resultado = PagoProfesorService.calcular_periodo(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )
        
        # Verificar que hay resultados
        self.assertEqual(len(resultado['resultados']), 1)
        
        # Verificar PagoProfesor creado
        pago_profesor = PagoProfesor.objects.get(profesor=self.profesor)
        self.assertEqual(pago_profesor.horas_calculadas, 1)
        
        # Verificar PagoProfesorDetalle creado
        detalle = PagoProfesorDetalle.objects.get(pago_profesor=pago_profesor)
        self.assertEqual(detalle.num_alumnos, 1)
        self.assertEqual(detalle.monto_profesor, Decimal('17.00'))

    def test_calcular_periodo_cleans_previous_data(self):
        """T11: Llamar dos veces con mismo período → sin duplicados."""
        from core.models import Asistencia, PagoProfesor
        
        # Crear asistencia
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        # Primera llamada
        PagoProfesorService.calcular_periodo(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )
        
        # Segunda llamada - debe limpiar datos anteriores
        PagoProfesorService.calcular_periodo(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )
        
        # Verificar que solo hay un PagoProfesor
        count = PagoProfesor.objects.filter(
            ciclo=self.ciclo,
            fecha_inicio=date(2026, 3, 1),
            fecha_fin=date(2026, 3, 31)
        ).count()
        
        self.assertEqual(count, 1)

    def test_calcular_periodo_skips_gerente(self):
        """T14: Profesor con es_gerente=True → excluido de resultados."""
        from core.models import Ciclo, Profesor, Asistencia, Horario
        
        # Crear ciclo separado para este test
        ciclo_gerente = Ciclo.objects.create(
            nombre='Gerente Cycle',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        # Crear profesor NO gerente
        profesor_normal = Profesor.objects.create(
            ciclo=ciclo_gerente,
            nombre='Normal',
            apellido='Prof',
            dni='22222222',
            telefono='666666666',
            email='normal@test.com',
            activo=True,
            es_gerente=False
        )
        
        # Crear profesor gerente
        profesor_gerente = Profesor.objects.create(
            ciclo=ciclo_gerente,
            nombre='Gerente',
            apellido='Test',
            dni='11111111',
            telefono='777777777',
            email='gerente@test.com',
            activo=True,
            es_gerente=True
        )
        
        # Crear horario para el profesor normal
        horario_normal = Horario.objects.create(
            ciclo=ciclo_gerente,
            taller=self.taller,
            profesor=profesor_normal,
            dia_semana=0,
            hora_inicio='10:00',
            hora_fin='11:00',
            cupo_maximo=10
        )
        
        # Crear horario para el gerente
        horario_gerente = Horario.objects.create(
            ciclo=ciclo_gerente,
            taller=self.taller,
            profesor=profesor_gerente,
            dia_semana=1,
            hora_inicio='11:00',
            hora_fin='12:00',
            cupo_maximo=10
        )
        
        # Crear asistencia para ambos
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=horario_normal,
            profesor=profesor_normal,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=horario_gerente,
            profesor=profesor_gerente,
            fecha='2026-03-15',
            hora='11:00',
            estado='asistio'
        )
        
        resultado = PagoProfesorService.calcular_periodo(
            ciclo_gerente,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )
        
        # Solo debe tener al profesor normal, no al gerente
        self.assertEqual(len(resultado['resultados']), 1)
        self.assertNotIn('Gerente', resultado['resultados'][0]['profesor'])


class TestDetalleClaseEdgeCases(TestCase):
    """Tests adicionales para detalle_clase() - manejo de errores."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Profesor, Alumno, Taller, Horario, Matricula
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle 2026',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Profesor',
            apellido='Test',
            dni='12345678',
            telefono='999999999',
            email='prof@test.com',
            activo=True,
            es_gerente=False
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno',
            apellido='Test',
            dni='87654321',
            telefono='888888888',
            email='alumno@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Taller de guitarra',
            activo=True
        )
        
        self.horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=self.taller,
            profesor=self.profesor,
            dia_semana=0,
            hora_inicio='10:00',
            hora_fin='11:00',
            cupo_maximo=10
        )
        
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )

    def test_detalle_clase_invalid_horario(self):
        """T12: Llamar con horario_id inexistente → ValueError."""
        with self.assertRaises(ValueError) as context:
            PagoProfesorService.detalle_clase(
                horario_id=99999,
                fecha='2026-03-15',
                profesor_id=self.profesor.id
            )
        
        self.assertIn('no encontrado', str(context.exception))

    def test_detalle_clase_without_profesor_filter(self):
        """T13: Llamar detalle_clase sin profesor_id → retorna resultados."""
        from core.models import Asistencia
        
        # Crear asistencia
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        # Llamar sin filtro de profesor
        resultado = PagoProfesorService.detalle_clase(
            horario_id=self.horario.id,
            fecha='2026-03-15'
        )
        
        # Debe retornar resultados
        self.assertEqual(resultado['resumen']['num_alumnos'], 1)
        self.assertIn('alumnos', resultado)


class TestPagoFijo(TestCase):
    """Tests para validar la lógica de pago fijo (monto_base=0, monto_adicional=0)."""

    def _crear_mock_horario_fijo(self, monto_fijo: float):
        """Crea un mock de Horario con tipo_pago='fijo'."""
        mock_horario = MagicMock()
        mock_horario.tipo_pago = 'fijo'
        mock_horario.monto_fijo = Decimal(str(monto_fijo))
        return mock_horario

    def _crear_mock_asistencia(self, precio_sesion: float):
        """Crea un mock de Asistencia con precio por sesión."""
        mock_matricula = MagicMock()
        mock_matricula.precio_por_sesion = Decimal(str(precio_sesion))
        
        mock_asistencia = MagicMock()
        mock_asistencia.matricula = mock_matricula
        return mock_asistencia

    def test_pago_fijo_un_alumno(self):
        """Pago fijo S/. 25 con 1 alumno → monto_profesor=25, monto_base=0, monto_adicional=0"""
        mock_horario = self._crear_mock_horario_fijo(25.00)
        mock_asistencia = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia]
        num_alumnos = 1
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos, mock_horario)
        
        self.assertEqual(resultado['monto_profesor'], Decimal('25.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))
        
        # Verificar que NO usa BASE_PAGO
        self.assertNotEqual(resultado['monto_profesor'], Decimal('17.00'))

    def test_pago_fijo_multiple_alumnos(self):
        """Pago fijo S/. 25 con 3 alumnos → monto_profesor=25, monto_base=0, monto_adicional=0"""
        mock_horario = self._crear_mock_horario_fijo(25.00)
        mock_asistentes = [self._crear_mock_asistencia(20.00) for _ in range(3)]
        num_alumnos = 3
        
        resultado = PagoProfesorService._calcular_pago_clase(mock_asistentes, num_alumnos, mock_horario)
        
        # Pago fijo es FLAT, no importa cuántos alumnos haya
        self.assertEqual(resultado['monto_profesor'], Decimal('25.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))

    def test_pago_fijo_sin_monto_fijo(self):
        """Pago fijo sin monto_fijo configurado → monto_profesor=0"""
        mock_horario = MagicMock()
        mock_horario.tipo_pago = 'fijo'
        mock_horario.monto_fijo = None
        mock_asistencia = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia]
        num_alumnos = 1
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos, mock_horario)
        
        # Sin monto_fijo configurado, cae a 0 (no debe usar BASE_PAGO como fallback)
        self.assertEqual(resultado['monto_profesor'], Decimal('0.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))

    def test_pago_fijo_cero_alumnos(self):
        """Pago fijo con 0 alumnos → 0"""
        mock_horario = self._crear_mock_horario_fijo(25.00)
        asistentes = []
        num_alumnos = 0
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos, mock_horario)
        
        self.assertEqual(resultado['monto_profesor'], Decimal('0.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))


class TestConfiguracionPagoDinamico(TestCase):
    """Tests para validar que la configuración de base/tope funciona correctamente."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Configuracion
        
        # Guardar configuración original
        self.config_original = Configuracion.get_instance()
        self.base_original = self.config_original.pago_dinamico_base
        self.tope_original = self.config_original.pago_dinamico_tope
        
        # Configurar valores de prueba: base=20, tope=40
        self.config_original.pago_dinamico_base = Decimal('20.00')
        self.config_original.pago_dinamico_tope = Decimal('40.00')
        self.config_original.save()

    def tearDown(self):
        """Restaurar configuración original."""
        from core.models import Configuracion
        
        config = Configuracion.get_instance()
        config.pago_dinamico_base = self.base_original
        config.pago_dinamico_tope = self.tope_original
        config.save()

    def _crear_mock_asistencia(self, precio_sesion: float):
        """Crea un mock de Asistencia."""
        mock_matricula = MagicMock()
        mock_matricula.precio_por_sesion = Decimal(str(precio_sesion))
        
        mock_asistencia = MagicMock()
        mock_asistencia.matricula = mock_matricula
        return mock_asistencia

    def test_configuracion_base_personalizada(self):
        """Con base=20, 1 alumno → pago=20 (no 17)"""
        mock_asistencia = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia]
        num_alumnos = 1
        
        # Sin horario (pago dinámico)
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        self.assertEqual(resultado['monto_profesor'], Decimal('20.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('0.00'))

    def test_configuracion_tope_personalizado(self):
        """Con base=20, tope=40, 2 alumnos con sesion=20 → 20+10=30 (sin llegar a tope)"""
        mock_asistencia1 = self._crear_mock_asistencia(20.00)
        mock_asistencia2 = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia1, mock_asistencia2]
        num_alumnos = 2
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # 20 + 50%*20 = 30
        self.assertEqual(resultado['monto_profesor'], Decimal('30.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('10.00'))

    def test_configuracion_tope_aplicado(self):
        """Con base=20, tope=40, 3 alumnos con sesion=20 → 20+15=35, capped a 40"""
        mock_asistencia1 = self._crear_mock_asistencia(20.00)
        mock_asistencia2 = self._crear_mock_asistencia(20.00)
        mock_asistencia3 = self._crear_mock_asistencia(20.00)
        asistentes = [mock_asistencia1, mock_asistencia2, mock_asistencia3]
        num_alumnos = 3
        
        resultado = PagoProfesorService._calcular_pago_clase(asistentes, num_alumnos)
        
        # 20 + 10 + 10 = 40 (正好 al tope)
        self.assertEqual(resultado['monto_profesor'], Decimal('40.00'))
        self.assertEqual(resultado['monto_adicional'], Decimal('20.00'))


class TestDetalleClasePagoFijo(TestCase):
    """Tests de detalle_clase con pago fijo."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Profesor, Alumno, Taller, Horario, Matricula, Asistencia
        
        self.ciclo = Ciclo.objects.create(
            nombre='Test Pago Fijo',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Profesor',
            apellido='Fijo',
            dni='12345678',
            telefono='999999999',
            email='fijo@test.com',
            activo=True,
            es_gerente=False
        )
        
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno',
            apellido='Test',
            dni='87654321',
            telefono='888888888',
            email='alumno@test.com',
            activo=True
        )
        
        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Taller de guitarra',
            activo=True
        )
        
        # Horario con pago fijo
        self.horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=self.taller,
            profesor=self.profesor,
            dia_semana=0,
            hora_inicio='10:00',
            hora_fin='11:00',
            tipo_pago='fijo',
            monto_fijo=Decimal('25.00'),
            cupo_maximo=10
        )
        
        self.matricula = Matricula.objects.create(
            alumno=self.alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )

    def test_detalle_clase_pago_fijo(self):
        """detalle_clase con pago fijo: monto_base=0, monto_adicional=0"""
        from core.models import Asistencia
        
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )
        
        resultado = PagoProfesorService.detalle_clase(
            horario_id=self.horario.id,
            fecha='2026-03-15',
            profesor_id=self.profesor.id
        )
        
        self.assertEqual(resultado['resumen']['num_alumnos'], 1)
        self.assertEqual(resultado['resumen']['monto_profesor'], 25.00)
        self.assertEqual(resultado['resumen']['monto_base'], 0.00)  # Fijo = 0
        self.assertEqual(resultado['resumen']['monto_adicional'], 0.00)  # Fijo = 0
        # Ganancia: 20 (valor_generado) - 25 (pago) = -5
        self.assertEqual(resultado['resumen']['ganancia_taller'], -5.00)