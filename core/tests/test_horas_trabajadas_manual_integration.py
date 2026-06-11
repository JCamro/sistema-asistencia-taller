"""
Tests de integración para el flujo completo de horas trabajadas manuales.

Cubre el caso de uso: admin crea manualmente HoraTrabajada con tipo='clase_regular'
para clases de prueba o clases donde todos los alumnos faltaron sin aviso.
El profesor debe cobrar BASE_PAGO aunque haya 0 alumnos (vino al local).
"""
from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from core.models import (
    Ciclo, Profesor, Alumno, Taller, Horario, Matricula,
    Asistencia, HoraTrabajada, Configuracion,
)
from core.services.hora_trabajada_service import HoraTrabajadaService
from core.services.pago_profesor_service import PagoProfesorService


class TestManualClaseRegularIntegration(TestCase):
    """Flujo completo: admin crea manual clase_regular con 0 alumnos."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Test',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='12345678',
            telefono='999999999',
            email='juan@test.com',
            activo=True,
            es_gerente=False
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
            cupo_maximo=10,
            tipo_pago='dinamico'
        )

    def test_manual_clase_regular_cero_alumnos_paga_base(self):
        """
        CASO: Clase de prueba o todos faltaron sin aviso.
        El profesor vino al local → debe cobrar BASE_PAGO.
        """
        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': self.horario.id,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 0,
            'observacion': 'Clase de prueba - alumno aún no matriculado'
        }

        ht = HoraTrabajadaService.crear_manual(data)

        # Verificar que se creó correctamente
        self.assertIsNotNone(ht)
        self.assertEqual(ht.tipo, 'clase_regular')
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.created_from, 'admin_manual')
        self.assertEqual(ht.num_alumnos, 0)

        # Verificar que el monto_profesor = BASE_PAGO (17.00)
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))
        self.assertEqual(ht.monto_base, Decimal('17.00'))
        self.assertEqual(ht.monto_adicional, Decimal('0.00'))

        # Verificar que valor_generado = 0 (no hay alumnos matriculados)
        self.assertEqual(ht.valor_generado, Decimal('0.00'))

        # Verificar que ganancia_taller es negativo (el taller pierde dinero)
        self.assertEqual(ht.ganancia_taller, Decimal('-17.00'))

    def test_manual_clase_regular_un_alumno_paga_base(self):
        """
        CASO: Admin registra manualmente clase con 1 alumno (prueba).
        Fórmula: 1 alumno → BASE_PAGO (17.00)
        """
        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': self.horario.id,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 1,
            'observacion': 'Clase manual con 1 alumno'
        }

        ht = HoraTrabajadaService.crear_manual(data)

        # 1 alumno → base
        self.assertEqual(ht.monto_base, Decimal('17.00'))
        self.assertEqual(ht.monto_adicional, Decimal('0.00'))
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))

    def test_generator_respeta_manual_no_sobreescribe(self):
        """
        CASO: Admin crea manual, luego se ejecuta generator.
        El generator NO debe sobreescribir el registro manual.
        """
        # 1. Admin crea manual para (profesor, horario, fecha)
        data_manual = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': self.horario.id,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 0,
            'observacion': 'Manual - clase de prueba'
        }
        ht_manual = HoraTrabajadaService.crear_manual(data_manual)
        self.assertEqual(ht_manual.monto_profesor, Decimal('17.00'))
        self.assertEqual(ht_manual.observacion, 'Manual - clase de prueba')

        # 2. Crear asistencia para mismo (profesor, horario, fecha)
        alumno = Alumno.objects.create(
            ciclo=self.ciclo,
            nombre='Alumno',
            apellido='Test',
            dni='87654321',
            telefono='888888888',
            email='alumno@test.com',
            activo=True
        )
        matricula = Matricula.objects.create(
            alumno=alumno,
            ciclo=self.ciclo,
            taller=self.taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('10.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )
        Asistencia.objects.create(
            matricula=matricula,
            horario=self.horario,
            profesor=self.profesor,
            fecha=date(2026, 3, 15),
            hora='10:30',
            estado='asistio'
        )

        # 3. Ejecutar generator
        resultado = HoraTrabajadaService.generar_horas_trabajadas(
            self.ciclo,
            date(2026, 3, 1),
            date(2026, 3, 31)
        )

        # 4. Verificar que NO se creó nuevo registro para ese combo
        # (el manual ya existe, el generator lo saltea)
        ht_registros = HoraTrabajada.objects.filter(
            profesor=self.profesor,
            horario=self.horario,
            fecha=date(2026, 3, 15)
        )
        self.assertEqual(ht_registros.count(), 1, "Solo debe haber 1 registro (el manual)")

        # 5. Verificar que el registro sigue siendo el manual
        ht = ht_registros.first()
        self.assertEqual(ht.created_from, 'admin_manual')
        self.assertEqual(ht.observacion, 'Manual - clase de prueba')
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))

    def test_manual_aprobar_calcular_periodo_incluye_en_pago(self):
        """
        CASO: Admin crea manual, aprueba, luego calcular_periodo.
        El registro manual debe incluirse en el PagoProfesor.
        """
        # 1. Crear manual
        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': self.horario.id,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 0,
            'observacion': 'Clase de prueba'
        }
        ht = HoraTrabajadaService.crear_manual(data)
        self.assertEqual(ht.estado, 'pendiente')

        # 2. Aprobar
        HoraTrabajadaService.aprobar(ht)
        ht.refresh_from_db()
        self.assertEqual(ht.estado, 'aprobada')

        # 3. Ejecutar calcular_periodo (calcula para todos los profesores)
        resultado = PagoProfesorService.calcular_periodo(
            ciclo=self.ciclo,
            fecha_inicio=date(2026, 3, 1),
            fecha_fin=date(2026, 3, 31),
            regenerar_horas=False  # No generar, solo calcular
        )

        # 4. Verificar que se creó PagoProfesor para nuestro profesor
        from core.models import PagoProfesor
        pago = PagoProfesor.objects.filter(
            profesor=self.profesor,
            ciclo=self.ciclo,
            fecha_inicio=date(2026, 3, 1),
            fecha_fin=date(2026, 3, 31)
        ).first()
        
        self.assertIsNotNone(pago, "Debe existir PagoProfesor para el profesor")
        self.assertEqual(pago.horas_calculadas, 1)
        self.assertEqual(pago.monto_final, Decimal('17.00'))

    def test_manual_duplicada_integrity_error_manejado(self):
        """
        CASO: Admin intenta crear manual para mismo combo que ya existe.
        Debe manejar IntegrityError y retornar ValueError con mensaje claro.
        """
        # 1. Crear primera manual
        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': self.horario.id,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 0,
        }
        ht1 = HoraTrabajadaService.crear_manual(data)
        self.assertIsNotNone(ht1)

        # 2. Intentar crear segunda para mismo combo
        # El servicio captura IntegrityError y lo convierte en ValueError
        with self.assertRaises(ValueError) as ctx:
            HoraTrabajadaService.crear_manual(data)
        self.assertIn('Ya existe un registro', str(ctx.exception))

    def test_pago_fijo_manual_cero_alumnos_no_paga_base(self):
        """
        CASO: Horario con tipo_pago='fijo', admin crea manual con 0 alumnos.
        Pago fijo NO paga por venir (solo paga por alumno atendido).
        """
        horario_fijo = Horario.objects.create(
            ciclo=self.ciclo,
            taller=self.taller,
            profesor=self.profesor,
            dia_semana=1,
            hora_inicio='14:00',
            hora_fin='15:00',
            cupo_maximo=5,
            tipo_pago='fijo',
            monto_fijo=Decimal('25.00')
        )

        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': horario_fijo.id,
            'fecha': date(2026, 3, 15),
            'tipo': 'clase_regular',
            'horas_trabajadas': Decimal('1.00'),
            'num_alumnos': 0,
            'observacion': 'Clase fija con 0 alumnos'
        }

        ht = HoraTrabajadaService.crear_manual(data)

        # Pago fijo con 0 alumnos → monto_profesor = 0
        self.assertEqual(ht.monto_profesor, Decimal('0.00'))
        self.assertEqual(ht.monto_base, Decimal('0.00'))


class TestManualClaseRegularAPIIntegration(APITestCase):
    """Tests de integración vía API REST."""

    def setUp(self):
        from django.contrib.auth.models import User
        self.user = User.objects.create_user(
            username='admin',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo Test',
            tipo='anual',
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            activo=True
        )
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo,
            nombre='Juan',
            apellido='Pérez',
            dni='12345678',
            telefono='999999999',
            email='juan@test.com',
            activo=True,
            es_gerente=False
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
            cupo_maximo=10,
            tipo_pago='dinamico'
        )

    def test_api_create_clase_regular_success(self):
        """
        CASO: POST /api/horas-trabajadas/ con tipo='clase_regular'.
        Debe crear exitosamente con auto-cálculo de montos.
        """
        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': self.horario.id,
            'fecha': '2026-03-15',
            'tipo': 'clase_regular',
            'horas_trabajadas': '1.00',
            'num_alumnos': 0,
            'observacion': 'Clase de prueba vía API'
        }

        response = self.client.post('/api/horas-trabajadas/', data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tipo'], 'clase_regular')
        
        # Verificar el objeto creado directamente en DB
        ht = HoraTrabajada.objects.get(
            profesor=self.profesor,
            horario=self.horario,
            fecha=date(2026, 3, 15),
            tipo='clase_regular'
        )
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.created_from, 'admin_manual')
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))

    def test_api_update_aprobada_returns_400(self):
        """
        CASO: PATCH /api/horas-trabajadas/{id}/ con estado='aprobada'.
        Debe retornar 400 (no permitir editar aprobadas).
        """
        # Crear y aprobar
        ht = HoraTrabajada.objects.create(
            profesor=self.profesor,
            ciclo=self.ciclo,
            horario=self.horario,
            fecha=date(2026, 3, 15),
            tipo='clase_regular',
            horas_trabajadas=Decimal('1.00'),
            estado='aprobada',
            num_alumnos=0,
            monto_profesor=Decimal('17.00'),
            monto_base=Decimal('17.00'),
            monto_adicional=Decimal('0.00'),
            valor_generado=Decimal('0.00'),
            ganancia_taller=Decimal('-17.00'),
            created_from='admin_manual'
        )

        # Intentar editar
        data = {'observacion': 'Cambio observación'}
        response = self.client.patch(f'/api/horas-trabajadas/{ht.id}/', data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_api_delete_aprobada_returns_400(self):
        """
        CASO: DELETE /api/horas-trabajadas/{id}/ con estado='aprobada'.
        Debe retornar 400 (no permitir eliminar aprobadas).
        """
        ht = HoraTrabajada.objects.create(
            profesor=self.profesor,
            ciclo=self.ciclo,
            horario=self.horario,
            fecha=date(2026, 3, 15),
            tipo='clase_regular',
            horas_trabajadas=Decimal('1.00'),
            estado='aprobada',
            num_alumnos=0,
            monto_profesor=Decimal('17.00'),
            monto_base=Decimal('17.00'),
            monto_adicional=Decimal('0.00'),
            valor_generado=Decimal('0.00'),
            ganancia_taller=Decimal('-17.00'),
            created_from='admin_manual'
        )

        response = self.client.delete(f'/api/horas-trabajadas/{ht.id}/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
