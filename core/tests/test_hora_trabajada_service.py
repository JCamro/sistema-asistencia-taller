"""
Tests para core/services/hora_trabajada_service.py

Verifica la generación automática desde asistencias, creación manual
y la máquina de estados para aprobación/rechazo.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from django.test import TestCase

from core.services.hora_trabajada_service import HoraTrabajadaService
from core.models import HoraTrabajada


class TestGenerarHorasTrabajadas(TestCase):
    """Tests para generar_horas_trabajadas()."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Profesor, Alumno, Taller, Horario, Matricula

        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
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

    def test_empty_asistencia_returns_zero_rows(self):
        """Sin asistencias en el período → 0 registros creados."""
        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 0)
        self.assertEqual(resultado['actualizados'], 0)

    def test_generar_creates_hora_trabajada(self):
        """Con asistencia 'asistio' → crea 1 HoraTrabajada."""
        from core.models import Asistencia

        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)
        self.assertEqual(resultado['actualizados'], 0)

        ht = HoraTrabajada.objects.get(
            profesor=self.profesor,
            horario=self.horario,
            fecha=date(2026, 3, 15)
        )
        self.assertEqual(ht.estado, 'aprobada')
        self.assertEqual(ht.tipo, 'clase_regular')
        self.assertEqual(ht.created_from, 'asistencia_auto')
        self.assertEqual(ht.num_alumnos, 1)
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))

    def test_idempotent_generar(self):
        """Ejecutar generar_horas_trabajadas dos veces → mismo row count."""
        from core.models import Asistencia

        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )

        # Primera ejecución
        resultado1 = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        # Segunda ejecución
        resultado2 = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        self.assertEqual(resultado1['creados'], 1)
        self.assertEqual(resultado2['creados'], 0)
        self.assertEqual(resultado2['actualizados'], 1)

        # Solo debe haber 1 registro
        count = HoraTrabajada.objects.filter(
            profesor=self.profesor,
            horario=self.horario,
            fecha=date(2026, 3, 15)
        ).count()
        self.assertEqual(count, 1)

    def test_skip_no_attendance(self):
        """Asistencia con estado 'ausente' → no crea HoraTrabajada."""
        from core.models import Asistencia

        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='ausente'
        )

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 0)
        self.assertEqual(HoraTrabajada.objects.count(), 0)

    def test_multiple_asistencias_grouped(self):
        """Varias asistencias mismo horario+fecha → 1 HoraTrabajada (agrupada)."""
        from core.models import Asistencia, Alumno, Matricula

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

        # Dos asistencias mismo horario, misma fecha
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

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        # Solo 1 HoraTrabajada (agrupada por profesor+horario+fecha)
        self.assertEqual(resultado['creados'], 1)
        ht = HoraTrabajada.objects.get(
            profesor=self.profesor,
            horario=self.horario,
            fecha=date(2026, 3, 15)
        )
        self.assertEqual(ht.num_alumnos, 2)

    def test_config_snapshot_capture(self):
        """HoraTrabajada tiene config_snapshot con valores de Configuracion."""
        from core.models import Asistencia

        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )

        HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        ht = HoraTrabajada.objects.get(
            profesor=self.profesor,
            fecha=date(2026, 3, 15)
        )
        snapshot = ht.config_snapshot
        self.assertIsNotNone(snapshot)
        self.assertIn('base_pago', snapshot)
        self.assertIn('tope_maximo', snapshot)
        self.assertIn('porcentaje_adicional', snapshot)
        self.assertEqual(snapshot['base_pago'], 17.0)
        self.assertEqual(snapshot['tope_maximo'], 35.0)

    def test_generar_respects_date_range(self):
        """Asistencia fuera del rango de fechas → no se incluye."""
        from core.models import Asistencia

        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-04-15',  # Fuera del rango
            hora='10:00',
            estado='asistio'
        )

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 0)


class TestCrearManual(TestCase):
    """Tests para crear_manual()."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Profesor, Taller, Horario

        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
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

        self.taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Test',
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

    def test_crear_manual_asistencia_success(self):
        """Crear manual con tipo 'asistencia' → éxito."""
        ht = HoraTrabajadaService.crear_manual({
            'profesor': self.profesor.id,
            'ciclo': self.ciclo,
            'horario': self.horario,
            'fecha': date(2026, 3, 15),
            'tipo': 'asistencia',
            'horas_trabajadas': Decimal('2.00'),
            'num_alumnos': 5,
            'valor_generado': Decimal('100.00'),
            'monto_profesor': Decimal('30.00'),
            'observacion': 'Apoyo en clase',
        })

        self.assertEqual(ht.tipo, 'asistencia')
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.created_from, 'admin_manual')
        self.assertEqual(ht.horas_trabajadas, Decimal('2.00'))
        self.assertIsNotNone(ht.config_snapshot)

    def test_crear_manual_clase_regular_raises(self):
        """Crear manual con tipo 'clase_regular' → ValueError."""
        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': self.profesor.id,
                'ciclo': self.ciclo,
                'fecha': date(2026, 3, 15),
                'tipo': 'clase_regular',
                'horas_trabajadas': Decimal('1.00'),
            })
        self.assertIn('No se puede crear manualmente', str(ctx.exception))

    def test_crear_manual_hora_extra_with_horario_raises(self):
        """Hora extra con horario → ValueError."""
        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': self.profesor.id,
                'ciclo': self.ciclo,
                'horario': self.horario,
                'fecha': date(2026, 3, 15),
                'tipo': 'hora_extra',
                'horas_trabajadas': Decimal('1.00'),
            })
        self.assertIn('Hora extra no debe tener horario', str(ctx.exception))

    def test_crear_manual_profesor_inactivo_raises(self):
        """Profesor inactivo → ValueError."""
        from core.models import Profesor

        profesor_inactivo = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Inactivo',
            apellido='Test',
            dni='99999999',
            telefono='999999999',
            email='inactivo@test.com',
            activo=False,
            es_gerente=False
        )

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': profesor_inactivo.id,
                'ciclo': self.ciclo,
                'horario': self.horario,
                'fecha': date(2026, 3, 15),
                'tipo': 'asistencia',
                'horas_trabajadas': Decimal('1.00'),
            })
        self.assertIn('Profesor no encontrado o inactivo', str(ctx.exception))

    def test_crear_manual_fecha_futura_raises(self):
        """Fecha futura → ValueError."""
        fecha_futura = date.today() + timedelta(days=30)

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': self.profesor.id,
                'ciclo': self.ciclo,
                'horario': self.horario,
                'fecha': fecha_futura,
                'tipo': 'asistencia',
                'horas_trabajadas': Decimal('1.00'),
            })
        self.assertIn('La fecha no puede ser futura', str(ctx.exception))

    def test_crear_manual_horas_cero_raises(self):
        """horas_trabajadas <= 0 → ValueError."""
        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': self.profesor.id,
                'ciclo': self.ciclo,
                'horario': self.horario,
                'fecha': date(2026, 3, 15),
                'tipo': 'asistencia',
                'horas_trabajadas': Decimal('0.00'),
            })
        self.assertIn('deben ser mayores a 0', str(ctx.exception))

    def test_crear_manual_profesor_not_found_raises(self):
        """ID de profesor inexistente → ValueError."""
        profesor_fake = MagicMock()
        profesor_fake.id = 99999

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': profesor_fake.id,
                'ciclo': self.ciclo,
                'horario': self.horario,
                'fecha': date(2026, 3, 15),
                'tipo': 'asistencia',
                'horas_trabajadas': Decimal('1.00'),
            })
        self.assertIn('Profesor no encontrado o inactivo', str(ctx.exception))


class TestStateMachine(TestCase):
    """Tests para la máquina de estados de HoraTrabajada."""

    def setUp(self):
        """Crear datos de prueba."""
        from core.models import Ciclo, Profesor

        self.ciclo = Ciclo.objects.create(
            nombre='Test Cycle',
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

        self.ht = HoraTrabajada.objects.create(
            profesor=self.profesor,
            ciclo=self.ciclo,
            fecha=date(2026, 3, 15),
            tipo='asistencia',
            horas_trabajadas=Decimal('1.00'),
            estado='pendiente',
        )

    def test_aprobar_pendiente(self):
        """pendiente → aprobada."""
        resultado = HoraTrabajadaService.aprobar(self.ht)
        self.assertEqual(resultado.estado, 'aprobada')

    def test_rechazar_pendiente(self):
        """pendiente → rechazada."""
        resultado = HoraTrabajadaService.rechazar(self.ht)
        self.assertEqual(resultado.estado, 'rechazada')

    def test_aprobar_aprobada_raises(self):
        """aprobada → aprobar → ValueError."""
        self.ht.estado = 'aprobada'
        self.ht.save()

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.aprobar(self.ht)
        self.assertIn('Solo se pueden aprobar', str(ctx.exception))

    def test_rechazar_aprobada_raises(self):
        """aprobada → rechazar → ValueError."""
        self.ht.estado = 'aprobada'
        self.ht.save()

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.rechazar(self.ht)
        self.assertIn('Solo se pueden rechazar', str(ctx.exception))

    def test_aprobar_rechazada_raises(self):
        """rechazada → aprobar → ValueError."""
        self.ht.estado = 'rechazada'
        self.ht.save()

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.aprobar(self.ht)
        self.assertIn('Solo se pueden aprobar', str(ctx.exception))

    def test_rechazar_rechazada_raises(self):
        """rechazada → rechazar → ValueError."""
        self.ht.estado = 'rechazada'
        self.ht.save()

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.rechazar(self.ht)
        self.assertIn('Solo se pueden rechazar', str(ctx.exception))
