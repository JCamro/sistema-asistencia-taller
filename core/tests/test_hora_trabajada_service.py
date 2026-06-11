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

    def test_generar_skips_admin_manual_records(self):
        """Generator omite combos que ya tienen un registro admin_manual."""
        from core.models import Asistencia

        # Crear asistencia (para que el generator intente crear un registro)
        Asistencia.objects.create(
            matricula=self.matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )

        # Crear manualmente un registro admin_manual para el mismo combo
        HoraTrabajada.objects.create(
            profesor=self.profesor,
            ciclo=self.ciclo,
            horario=self.horario,
            fecha=date(2026, 3, 15),
            tipo='clase_regular',
            horas_trabajadas=Decimal('1.00'),
            estado='pendiente',
            num_alumnos=2,
            created_from='admin_manual',
        )

        # Ejecutar generación automática
        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        # No debe crear ni actualizar — el combo existe como admin_manual
        self.assertEqual(resultado['creados'], 0)
        self.assertEqual(resultado['actualizados'], 0)

        # El registro admin_manual debe seguir intacto (sin sobrescribir estado/valores)
        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=date(2026, 3, 15))
        self.assertEqual(ht.created_from, 'admin_manual')
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.num_alumnos, 2)


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

    def test_crear_manual_clase_regular_success(self):
        """Crear manual con tipo 'clase_regular' + horario + num_alumnos → éxito con auto-cálculo de montos."""
        ht = HoraTrabajadaService.crear_manual({
            'profesor': self.profesor.id,
            'ciclo': self.ciclo,
            'horario': self.horario,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 1,
        })

        self.assertEqual(ht.tipo, 'clase_regular')
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.created_from, 'admin_manual')
        # Auto-cálculo: 1 alumno dinámico → BASE_PAGO
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))
        self.assertEqual(ht.monto_base, Decimal('17.00'))
        self.assertEqual(ht.monto_adicional, Decimal('0.00'))
        self.assertIsNotNone(ht.config_snapshot)

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

    def test_crear_manual_clase_regular_explicit_montos(self):
        """Clase_regular con montos explícitos (con horario) preserva valores proporcionados."""
        ht = HoraTrabajadaService.crear_manual({
            'profesor': self.profesor.id,
            'ciclo': self.ciclo,
            'horario': self.horario,
            'fecha': date(2026, 3, 16),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('2.00'),
            'num_alumnos': 3,
            'valor_generado': Decimal('60.00'),
            'monto_base': Decimal('20.00'),
            'monto_adicional': Decimal('10.00'),
            'monto_profesor': Decimal('30.00'),
            'ganancia_taller': Decimal('30.00'),
            'observacion': 'Clase extra manual',
        })

        self.assertEqual(ht.tipo, 'clase_regular')
        # Los valores explícitos deben preservarse (el auto-cálculo solo llena lo faltante)
        self.assertEqual(ht.monto_profesor, Decimal('30.00'))
        self.assertEqual(ht.monto_base, Decimal('20.00'))
        self.assertEqual(ht.observacion, 'Clase extra manual')

    def test_crear_manual_clase_regular_duplicate_raises(self):
        """Crear dos veces mismo profesor+horario+fecha+tipo → IntegrityError."""
        HoraTrabajadaService.crear_manual({
            'profesor': self.profesor.id,
            'ciclo': self.ciclo,
            'horario': self.horario,
            'fecha': date(2026, 3, 17),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 1,
        })

        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual({
                'profesor': self.profesor.id,
                'ciclo': self.ciclo,
                'horario': self.horario,
                'fecha': date(2026, 3, 17),
                'tipo': 'clase_regular',
                'horas_trabajadas': Decimal('1.00'),
                'num_alumnos': 2,
            })
        self.assertIn('Ya existe un registro', str(ctx.exception))

    def test_crear_manual_pago_fijo_cero_alumnos(self):
        """Clase_regular con pago fijo y 0 alumnos → monto_profesor=0."""
        from core.models import Horario
        horario_fijo = Horario.objects.create(
            ciclo=self.ciclo,
            taller=self.taller,
            profesor=self.profesor,
            dia_semana=0,
            hora_inicio='14:00',
            hora_fin='15:00',
            tipo_pago='fijo',
            monto_fijo=Decimal('25.00'),
            cupo_maximo=10
        )
        ht = HoraTrabajadaService.crear_manual({
            'profesor': self.profesor.id,
            'ciclo': self.ciclo,
            'horario': horario_fijo,
            'fecha': date(2026, 3, 18),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 0,
        })

        self.assertEqual(ht.monto_profesor, Decimal('0.00'))
        self.assertEqual(ht.monto_base, Decimal('0.00'))


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


class TestConsolidacionHorariosSolapados(TestCase):
    """Tests para la consolidación de horarios solapados en generar_horas_trabajadas()."""

    def setUp(self):
        """Crear datos de prueba para solapamiento."""
        from core.models import (
            Ciclo, Profesor, Alumno, Taller, Horario, Matricula, Asistencia
        )

        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Test',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )

        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Carlos',
            apellido='García',
            dni='12345678',
            telefono='999999999',
            email='carlos@test.com',
            activo=True,
            es_gerente=False
        )

        # Alumnos para las asistencias
        self.alumno1 = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Alumno1', apellido='Test',
            dni='11111111', telefono='111111111', activo=True
        )
        self.alumno2 = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Alumno2', apellido='Test',
            dni='22222222', telefono='222222222', activo=True
        )
        self.alumno3 = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Alumno3', apellido='Test',
            dni='33333333', telefono='333333333', activo=True
        )
        self.alumno4 = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Alumno4', apellido='Test',
            dni='44444444', telefono='444444444', activo=True
        )

        # Talleres (nombres en orden alfabético para facilitar assertions)
        self.taller_bajo = Taller.objects.create(
            ciclo=self.ciclo, nombre='Bajo', tipo='instrumento', activo=True
        )
        self.taller_canto = Taller.objects.create(
            ciclo=self.ciclo, nombre='Canto', tipo='taller', activo=True
        )
        self.taller_guitarra = Taller.objects.create(
            ciclo=self.ciclo, nombre='Guitarra', tipo='instrumento', activo=True
        )

        # Horarios solapados (mismo dia_semana=0 Lunes, 10:00-11:00)
        # Creados en orden específico para IDs predecibles.
        # Bajo se crea primero → menor ID → representativo en solapamientos.
        self.horario_bajo = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller_bajo, profesor=self.profesor,
            dia_semana=0, hora_inicio='10:00', hora_fin='11:00',
            tipo_pago='dinamico', cupo_maximo=10
        )
        self.horario_canto = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller_canto, profesor=self.profesor,
            dia_semana=0, hora_inicio='10:00', hora_fin='11:00',
            tipo_pago='dinamico', cupo_maximo=10
        )
        self.horario_guitarra = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller_guitarra, profesor=self.profesor,
            dia_semana=0, hora_inicio='10:00', hora_fin='11:00',
            tipo_pago='dinamico', cupo_maximo=10
        )

        # Horario no solapado (distinta hora_inicio)
        self.horario_bajo_otro = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller_bajo, profesor=self.profesor,
            dia_semana=0, hora_inicio='11:00', hora_fin='12:00',
            tipo_pago='dinamico', cupo_maximo=10
        )

        # Matrículas con precio_por_sesion estándar de 20.00
        self.matricula_bajo_1 = Matricula.objects.create(
            alumno=self.alumno1, ciclo=self.ciclo, taller=self.taller_bajo,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )
        self.matricula_bajo_2 = Matricula.objects.create(
            alumno=self.alumno2, ciclo=self.ciclo, taller=self.taller_bajo,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )
        self.matricula_canto_1 = Matricula.objects.create(
            alumno=self.alumno3, ciclo=self.ciclo, taller=self.taller_canto,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )
        self.matricula_guitarra_1 = Matricula.objects.create(
            alumno=self.alumno4, ciclo=self.ciclo, taller=self.taller_guitarra,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )

        # Helper para crear asistencias rápido
        self.fecha_base = date(2026, 3, 16)  # Lunes (dia_semana=0)

    def _asistencia(self, matricula, horario, fecha=None, estado='asistio',
                    es_recuperacion=False):
        """Crea una asistencia de forma abreviada."""
        from core.models import Asistencia
        if fecha is None:
            fecha = self.fecha_base
        return Asistencia.objects.create(
            matricula=matricula, horario=horario, profesor=self.profesor,
            fecha=fecha, hora='10:00', estado=estado,
            es_recuperacion=es_recuperacion
        )

    def test_two_horarios_same_time_consolidated(self):
        """
        3.1 Dos horarios al mismo horario → 1 HoraTrabajada consolidada.
        Bajo (rep) + Canto (non-rep), 1 alumno cada uno → num_alumnos=2.
        """
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_canto_1, self.horario_canto)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)
        self.assertEqual(resultado['consolidados'], 1)

        # Solo debe haber 1 HoraTrabajada (consolidada, con el representativo)
        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.horario_id, self.horario_bajo.id)  # Representativo (menor ID)
        self.assertEqual(ht.num_alumnos, 2)
        self.assertEqual(ht.tipo, 'clase_regular')
        self.assertEqual(ht.observacion, 'Consolidado: Bajo + Canto')

    def test_partial_overlap_not_consolidated(self):
        """
        3.2 Horarios con distinta hora_inicio → 2 HoraTrabajada separadas.
        No hay solapamiento.
        """
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_bajo_2, self.horario_bajo_otro)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 2)
        self.assertEqual(resultado['consolidados'], 0)

        count = HoraTrabajada.objects.filter(
            profesor=self.profesor, fecha=self.fecha_base
        ).count()
        self.assertEqual(count, 2)

    def test_three_overlapping_horarios(self):
        """
        3.3 Tres horarios solapados → 1 consolidado con observacion correcta.
        """
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_canto_1, self.horario_canto)
        self._asistencia(self.matricula_guitarra_1, self.horario_guitarra)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)
        self.assertEqual(resultado['consolidados'], 1)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.num_alumnos, 3)
        self.assertEqual(ht.horario_id, self.horario_bajo.id)  # Representativo (menor ID)
        self.assertEqual(ht.observacion, 'Consolidado: Bajo + Canto + Guitarra')

    def test_consolidation_idempotent(self):
        """
        3.4 Re-ejecutar generar_horas_trabajadas → mismo resultado.
        """
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_canto_1, self.horario_canto)

        # Primera ejecución
        resultado1 = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )
        self.assertEqual(resultado1['creados'], 1)

        # Segunda ejecución
        resultado2 = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )
        self.assertEqual(resultado2['creados'], 0)
        self.assertEqual(resultado2['actualizados'], 1)
        self.assertEqual(resultado2['consolidados'], 1)

        # Solo debe haber 1 registro consolidado
        count = HoraTrabajada.objects.filter(
            profesor=self.profesor, fecha=self.fecha_base
        ).count()
        self.assertEqual(count, 1)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.num_alumnos, 2)

    def test_stale_cleanup(self):
        """
        3.5 Registros HT preexistentes de horarios no representativos
        son eliminados al re-ejecutar.
        """
        # Crear HT "obsoletos" manualmente (como si existieran de antes)
        from ..models import HoraTrabajada
        HoraTrabajada.objects.create(
            profesor=self.profesor, ciclo=self.ciclo, horario=self.horario_canto,
            fecha=self.fecha_base, tipo='clase_regular', estado='aprobada',
            horas_trabajadas=Decimal('1.00'), num_alumnos=1,
            valor_generado=Decimal('20.00'), monto_profesor=Decimal('17.00'),
            created_from='asistencia_auto'
        )

        # Ahora ejecutar con asistencias reales
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_canto_1, self.horario_canto)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        # No debe quedar el HT obsoleto de horario_canto
        stale_exists = HoraTrabajada.objects.filter(
            horario=self.horario_canto, fecha=self.fecha_base
        ).exists()
        self.assertFalse(stale_exists)

        # Solo debe quedar el consolidado (con horario_bajo representativo)
        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.horario_id, self.horario_bajo.id)
        self.assertEqual(ht.num_alumnos, 2)

    def test_consolidated_dynamic_payment_capped(self):
        """
        3.6 Pago dinámico consolidado: 4 alumnos (2+2) con precio_por_sesion=20.00.
        monto_adicional_bruto = 20*0.50*3 = 30.00
        total sin tope = 17+30 = 47.00
        tope=35.00 → monto_profesor=35.00
        """
        # Matrícula adicional para Bajo
        from ..models import Matricula
        matricula_bajo_3 = Matricula.objects.create(
            alumno=self.alumno3, ciclo=self.ciclo, taller=self.taller_bajo,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )
        matricula_canto_2 = Matricula.objects.create(
            alumno=self.alumno4, ciclo=self.ciclo, taller=self.taller_canto,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )

        # 2 alumnos en Bajo + 2 alumnos en Canto
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(matricula_bajo_3, self.horario_bajo)  # alumno3 en Bajo
        self._asistencia(self.matricula_canto_1, self.horario_canto)
        self._asistencia(matricula_canto_2, self.horario_canto)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)
        self.assertEqual(resultado['consolidados'], 1)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.num_alumnos, 4)
        self.assertEqual(ht.monto_base, Decimal('17.00'))
        # monto_adicional real = 35.00 - 17.00 = 18.00
        self.assertEqual(ht.monto_adicional, Decimal('18.00'))
        self.assertEqual(ht.monto_profesor, Decimal('35.00'))  # Topeado

    def test_consolidated_fixed_payment(self):
        """
        3.7 Pago fijo en el representativo → usa monto_fijo.
        Representative (Bajo) tiene tipo_pago='fijo', monto_fijo=25.00.
        """
        from ..models import Horario
        # Cambiar el horario_bajo (representativo) a pago fijo
        self.horario_bajo.tipo_pago = 'fijo'
        self.horario_bajo.monto_fijo = Decimal('25.00')
        self.horario_bajo.save()

        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_canto_1, self.horario_canto)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.num_alumnos, 2)
        self.assertEqual(ht.monto_base, Decimal('0.00'))
        self.assertEqual(ht.monto_adicional, Decimal('0.00'))
        self.assertEqual(ht.monto_profesor, Decimal('25.00'))

    def test_mixed_tipo_pago_observacion(self):
        """
        3.8 Tipo de pago mixto → observacion incluye '(mixto)'.
        Representative (Bajo)='dinamico', Canto='fijo'.
        """
        self.horario_canto.tipo_pago = 'fijo'
        self.horario_canto.monto_fijo = Decimal('30.00')
        self.horario_canto.save()

        self._asistencia(self.matricula_bajo_1, self.horario_bajo)
        self._asistencia(self.matricula_canto_1, self.horario_canto)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertIn('(mixto)', ht.observacion)
        # Representative (Bajo)='dinamico' → usa fórmula dinámica con 2 alumnos
        # 17.00 (base) + 20.00*0.5 (adicional) = 27.00
        self.assertEqual(ht.monto_profesor, Decimal('27.00'))

    def test_zero_asistencias_one_horario(self):
        """
        3.9 Un horario sin asistencias 'asistio' en el cluster.
        El horario sin asistencias no aparece en agrupadas,
        el otro se procesa como individual.
        """
        # Solo Bajo tiene asistencias; Canto no tiene ninguna 'asistio'
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        # Se procesa como individual, no hay consolidación
        self.assertEqual(resultado['creados'], 1)
        self.assertEqual(resultado['consolidados'], 0)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.num_alumnos, 1)
        self.assertEqual(ht.horario_id, self.horario_bajo.id)

    def test_recovery_excluded_from_consolidation(self):
        """
        3.10 Asistencias de recuperación excluidas de la consolidación.
        Canto (rep): 3 regulares.
        Guitarra (non-rep): 2 regulares + 1 recuperación.
        Consolidado: num_alumnos=5 (3+2), exclude la recuperación.
        Recuperación: HT separada para Guitarra con num_alumnos=1.
        """
        # Canto es el representativo (menor ID que Guitarra)
        # 3 asistencias regulares para Canto
        self._asistencia(self.matricula_canto_1, self.horario_canto)
        # Usar matrícula de Bajo para Canto (simular otro alumno)
        from ..models import Matricula
        matricula_canto_2 = Matricula.objects.create(
            alumno=self.alumno1, ciclo=self.ciclo, taller=self.taller_canto,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )
        matricula_canto_3 = Matricula.objects.create(
            alumno=self.alumno2, ciclo=self.ciclo, taller=self.taller_canto,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=False
        )
        self._asistencia(matricula_canto_2, self.horario_canto)
        self._asistencia(matricula_canto_3, self.horario_canto)

        # Guitarra: 2 regulares + 1 recuperación
        self._asistencia(self.matricula_guitarra_1, self.horario_guitarra)
        self._asistencia(self.matricula_bajo_1, self.horario_guitarra)
        self._asistencia(
            self.matricula_bajo_2, self.horario_guitarra,
            es_recuperacion=True
        )

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        # 1 consolidado + 1 recuperación = 2 creados
        self.assertEqual(resultado['creados'], 2)
        self.assertEqual(resultado['consolidados'], 1)

        # Verificar consolidado (Canto como representativo)
        ht_consolidado = HoraTrabajada.objects.get(
            profesor=self.profesor, horario=self.horario_canto,
            fecha=self.fecha_base, observacion__startswith='Consolidado'
        )
        self.assertEqual(ht_consolidado.num_alumnos, 5)  # 3+2, excluye recuperación

        # Verificar registro de recuperación (Guitarra)
        ht_recuperacion = HoraTrabajada.objects.get(
            profesor=self.profesor, horario=self.horario_guitarra,
            fecha=self.fecha_base, observacion='Recuperación'
        )
        self.assertEqual(ht_recuperacion.num_alumnos, 1)

    def test_single_non_overlapping_unchanged(self):
        """
        3.11 Horario individual sin solapamiento → comportamiento original.
        No hay observacion de consolidación.
        """
        self._asistencia(self.matricula_bajo_1, self.horario_bajo)

        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo, date(2026, 3, 1), date(2026, 3, 31)
        )

        self.assertEqual(resultado['creados'], 1)
        self.assertEqual(resultado['consolidados'], 0)

        ht = HoraTrabajada.objects.get(profesor=self.profesor, fecha=self.fecha_base)
        self.assertEqual(ht.num_alumnos, 1)
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))
        self.assertEqual(ht.observacion, '')
