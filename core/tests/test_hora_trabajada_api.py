"""
Tests para la API de HoraTrabajada.

Verifica los endpoints CRUD, acciones de estado (aprobar/rechazar),
y la acción de generación desde asistencias.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import HoraTrabajada


class TestHoraTrabajadaAPI(TestCase):
    """Tests para los endpoints de HoraTrabajada."""

    def setUp(self):
        """Crear datos de prueba y autenticación."""
        from django.contrib.auth.models import User
        from core.models import Ciclo, Profesor

        self.client = APIClient()

        # Crear y autenticar usuario
        self.user = User.objects.create_user(
            username='testadmin',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

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

        # Crear un registro de HoraTrabajada
        self.ht = HoraTrabajada.objects.create(
            profesor=self.profesor,
            ciclo=self.ciclo,
            fecha=date(2026, 3, 15),
            tipo='asistencia',
            horas_trabajadas=Decimal('1.00'),
            estado='pendiente',
            num_alumnos=3,
            valor_generado=Decimal('60.00'),
            monto_profesor=Decimal('25.00'),
        )

    def test_list_requires_auth(self):
        """GET sin autenticación → 401."""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/horas-trabajadas/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_horas_trabajadas(self):
        """GET list → retorna registros paginados."""
        response = self.client.get('/api/horas-trabajadas/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 1)

    def test_list_filter_by_estado(self):
        """GET list con ?estado=pendiente → filtra correctamente."""
        response = self.client.get('/api/horas-trabajadas/?estado=pendiente')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 1)

        response = self.client.get('/api/horas-trabajadas/?estado=aprobada')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 0)

    def test_list_filter_by_profesor(self):
        """GET list con ?profesor=X → filtra correctamente."""
        response = self.client.get(f'/api/horas-trabajadas/?profesor={self.profesor.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 1)

    def test_list_filter_by_tipo(self):
        """GET list con ?tipo=X → filtra correctamente."""
        response = self.client.get('/api/horas-trabajadas/?tipo=asistencia')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 1)

        response = self.client.get('/api/horas-trabajadas/?tipo=hora_extra')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 0)

    def test_list_filter_by_fecha_range(self):
        """GET list con ?fecha__gte=...&fecha__lte=... → filtra correctamente."""
        response = self.client.get(
            '/api/horas-trabajadas/?fecha__gte=2026-03-01&fecha__lte=2026-03-31'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 1)

        response = self.client.get(
            '/api/horas-trabajadas/?fecha__gte=2026-04-01&fecha__lte=2026-04-30'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 0)

    def test_create_manual_success(self):
        """POST crear manual → registra con estado pendiente."""
        from core.models import Taller, Horario

        taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Bateria',
            tipo='instrumento',
            descripcion='Taller de bateria',
            activo=True
        )
        horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=taller,
            profesor=self.profesor,
            dia_semana=1,
            hora_inicio='14:00',
            hora_fin='15:00',
            cupo_maximo=10
        )

        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': horario.id,
            'fecha': '2026-03-20',
            'tipo': 'asistencia',
            'horas_trabajadas': '2.00',
            'num_alumnos': 4,
            'observacion': 'Apoyo en clase',
        }
        response = self.client.post('/api/horas-trabajadas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        ht = HoraTrabajada.objects.get(fecha=date(2026, 3, 20))
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.created_from, 'admin_manual')

    def test_create_manual_clase_regular_success(self):
        """POST con tipo 'clase_regular' + horario + num_alumnos → 201 con auto-cálculo."""
        from core.models import Taller, Horario

        taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Bateria',
            tipo='instrumento',
            descripcion='Taller de bateria',
            activo=True
        )
        horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=taller,
            profesor=self.profesor,
            dia_semana=1,
            hora_inicio='14:00',
            hora_fin='15:00',
            cupo_maximo=10
        )

        data = {
            'profesor': self.profesor.id,
            'ciclo': self.ciclo.id,
            'horario': horario.id,
            'fecha': '2026-03-20',
            'tipo': 'clase_regular',
            'horas_trabajadas': '1.00',
            'num_alumnos': 2,
        }
        response = self.client.post('/api/horas-trabajadas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ht = HoraTrabajada.objects.get(fecha=date(2026, 3, 20))
        self.assertEqual(ht.tipo, 'clase_regular')
        self.assertEqual(ht.estado, 'pendiente')
        self.assertEqual(ht.created_from, 'admin_manual')
        # Auto-cálculo: 2 alumnos dinámico → BASE_PAGO (sin session values)
        self.assertEqual(ht.monto_profesor, Decimal('17.00'))

    def test_aprobar_endpoint(self):
        """PATCH /horas-trabajadas/{id}/aprobar/ → cambia a aprobada."""
        url = f'/api/horas-trabajadas/{self.ht.id}/aprobar/'
        response = self.client.patch(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.ht.refresh_from_db()
        self.assertEqual(self.ht.estado, 'aprobada')

    def test_aprobar_already_approved_returns_400(self):
        """PATCH aprobar en registro ya aprobado → 400."""
        self.ht.estado = 'aprobada'
        self.ht.save()

        url = f'/api/horas-trabajadas/{self.ht.id}/aprobar/'
        response = self.client.patch(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechazar_endpoint(self):
        """PATCH /horas-trabajadas/{id}/rechazar/ → cambia a rechazada."""
        url = f'/api/horas-trabajadas/{self.ht.id}/rechazar/'
        response = self.client.patch(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.ht.refresh_from_db()
        self.assertEqual(self.ht.estado, 'rechazada')

    def test_rechazar_already_rejected_returns_400(self):
        """PATCH rechazar en registro ya rechazado → 400."""
        self.ht.estado = 'rechazada'
        self.ht.save()

        url = f'/api/horas-trabajadas/{self.ht.id}/rechazar/'
        response = self.client.patch(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_pendiente_success(self):
        """DELETE registro pendiente → 204."""
        url = f'/api/horas-trabajadas/{self.ht.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(HoraTrabajada.objects.count(), 0)

    def test_delete_aprobada_returns_400(self):
        """DELETE registro aprobado → 400."""
        ht_aprobada = HoraTrabajada.objects.create(
            profesor=self.profesor,
            ciclo=self.ciclo,
            fecha=date(2026, 3, 16),
            tipo='asistencia',
            horas_trabajadas=Decimal('1.00'),
            estado='aprobada',
        )

        url = f'/api/horas-trabajadas/{ht_aprobada.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_detail(self):
        """GET /horas-trabajadas/{id}/ → retorna detalle completo."""
        url = f'/api/horas-trabajadas/{self.ht.id}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['id'], self.ht.id)
        self.assertIn('profesor_nombre', data)
        self.assertIn('tipo_display', data)
        self.assertIn('estado_display', data)
        self.assertIn('config_snapshot', data)

    def test_generar_action_missing_params(self):
        """POST /horas-trabajadas/generar/ sin ciclo_id → 400."""
        response = self.client.post('/api/horas-trabajadas/generar/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generar_action_missing_fechas(self):
        """POST /horas-trabajadas/generar/ sin fechas → 400."""
        response = self.client.post('/api/horas-trabajadas/generar/', {
            'ciclo_id': self.ciclo.id,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generar_action_success(self):
        """POST /horas-trabajadas/generar/ con asistencias → resultados."""
        from core.models import Alumno, Taller, Horario, Matricula, Asistencia

        taller = Taller.objects.create(
            ciclo=self.ciclo,
            nombre='Guitarra',
            tipo='instrumento',
            descripcion='Test',
            activo=True
        )
        horario = Horario.objects.create(
            ciclo=self.ciclo,
            taller=taller,
            profesor=self.profesor,
            dia_semana=0,
            hora_inicio='10:00',
            hora_fin='11:00',
            cupo_maximo=10
        )
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
            taller=taller,
            sesiones_contratadas=10,
            precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'),
            metodo_pago='efectivo',
            activo=True,
            concluida=False
        )
        Asistencia.objects.create(
            matricula=matricula,
            horario=horario,
            profesor=self.profesor,
            fecha='2026-03-15',
            hora='10:00',
            estado='asistio'
        )

        response = self.client.post('/api/horas-trabajadas/generar/', {
            'ciclo_id': self.ciclo.id,
            'fecha_inicio': '2026-03-01',
            'fecha_fin': '2026-03-31',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['creados'], 1)
        self.assertIn('ciclo', data)
        self.assertIn('fecha_inicio', data)
        self.assertIn('fecha_fin', data)

    def test_ciclo_endpoint_list(self):
        """GET /ciclos/{id}/horas-trabajadas/ → lista filtrada."""
        url = f'/api/ciclos/{self.ciclo.id}/horas-trabajadas/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 1)
