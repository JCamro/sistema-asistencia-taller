"""
Tests TDD para core/views/asistencia_view.py - Acción por_horario.

Expone bugs en la lógica de listado de asistencia por horario.
"""
from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    Ciclo, Alumno, Profesor, Taller, Horario, Matricula,
    MatriculaHorario, Asistencia
)


class TestAsistenciaPorHorario(TestCase):
    """Tests para el endpoint GET /ciclos/<ciclo_id>/asistencias/por-horario/."""

    def setUp(self):
        self.client = APIClient()
        self.ciclo = Ciclo.objects.create(
            nombre='Test', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        self.profesor = Profesor.objects.create(
            ciclo=self.ciclo, nombre='Prof', apellido='Test',
            dni='11223344', telefono='777', email='prof@test.com', activo=True
        )
        self.taller = Taller.objects.create(
            ciclo=self.ciclo, nombre='Guitarra', tipo='instrumento',
            descripcion='Guitarra', activo=True
        )
        self.horario = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller, profesor=self.profesor,
            dia_semana=0, hora_inicio='10:00', hora_fin='11:00', cupo_maximo=10
        )
        self.alumno = Alumno.objects.create(
            ciclo=self.ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', telefono='999', email='juan@test.com', activo=True
        )
        self.matricula = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo', activo=True
        )
        MatriculaHorario.objects.create(matricula=self.matricula, horario=self.horario)

        # Usuario con token
        from django.contrib.auth.models import User
        self.user = User.objects.create_user(username='testuser', password='testpass')
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_parametros_faltantes_retorna_400(self):
        """Sin horario_id o fecha, retorna 400."""
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_horario_no_existe_retorna_404(self):
        """Con horario_id inexistente, retorna 404."""
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id=99999&fecha=2024-03-01'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_horario_no_pertenece_al_ciclo_retorna_400(self):
        """Si el horario no pertenece al ciclo, retorna 400."""
        otro_ciclo = Ciclo.objects.create(
            nombre='Otro', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        otro_taller = Taller.objects.create(
            ciclo=otro_ciclo, nombre='Piano', tipo='instrumento',
            descripcion='Piano', activo=True
        )
        otro_horario = Horario.objects.create(
            ciclo=otro_ciclo, taller=otro_taller, profesor=self.profesor,
            dia_semana=1, hora_inicio='12:00', hora_fin='13:00', cupo_maximo=10
        )
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={otro_horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sin_asistencias_retorna_lista_vacia(self):
        """Sin ninguna asistencia, retorna lista vacía (pero con el alumno de la matrícula)."""
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={self.horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # El alumno de la matrícula DEBE aparecer aunque no tenga asistencia
        data = response.json()
        self.assertGreater(len(data), 0)
        self.assertEqual(data[0]['alumno_id'], self.alumno.id)
        self.assertEqual(data[0]['estado'], None)
        self.assertEqual(data[0]['asistencia_id'], None)

    def test_alumno_inactivo_no_aparece(self):
        """Alumno con matrícula inactiva no debe aparecer."""
        self.matricula.activo = False
        self.matricula.save()
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={self.horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        data = response.json()
        # El alumno inactivo no debe estar
        if len(data) > 0:
            self.assertTrue(all(item['alumno_id'] != self.alumno.id for item in data))

    def test_alumno_concluido_no_aparece(self):
        """Alumno con matrícula concluida no debe aparecer."""
        self.matricula.concluida = True
        self.matricula.save()
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={self.horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        data = response.json()
        if len(data) > 0:
            self.assertTrue(all(item['alumno_id'] != self.alumno.id for item in data))

    def test_asistencia_presente_retorna_estado(self):
        """Con asistencia creada, retorna el estado correcto."""
        Asistencia.objects.create(
            matricula=self.matricula, horario=self.horario,
            profesor=self.profesor, fecha='2024-03-01',
            hora=time(10, 0), estado='presente'
        )
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={self.horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['estado'], 'presente')
        self.assertIsNotNone(data[0]['asistencia_id'])
        self.assertFalse(data[0]['es_recuperacion'])

    def test_recuperacion_no_duplica_alumno_regular(self):
        """Un alumno en matrícula regular + asistencia recuperación no debe duplicarse."""
        # El alumno ya tiene matrícula regular con asistencia
        Asistencia.objects.create(
            matricula=self.matricula, horario=self.horario,
            profesor=self.profesor, fecha='2024-03-01',
            hora=time(10, 0), estado='presente'
        )
        # PERO también tiene una recuperación (fuera de matrícula)
        otra_matricula = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=True, concluida=True  # Distinta matrícula, concluida
        )
        Asistencia.objects.create(
            matricula=otra_matricula, horario=self.horario,
            profesor=self.profesor, fecha='2024-03-01',
            hora=time(10, 30), estado='presente', es_recuperacion=True
        )
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={self.horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        data = response.json()
        # Solo debe aparecer una vez
        ids = [item['alumno_id'] for item in data]
        self.assertEqual(ids.count(self.alumno.id), 1)

    def test_solo_recuperacion_aparece(self):
        """Si solo hay recuperación (sin matrícula regular activa), el alumno aparece."""
        # Eliminar la matrícula regular
        MatriculaHorario.objects.filter(matricula=self.matricula).delete()
        self.matricula.delete()

        otra_matricula = Matricula.objects.create(
            ciclo=self.ciclo, alumno=self.alumno, taller=self.taller,
            sesiones_contratadas=10, precio_total=Decimal('200.00'),
            precio_por_sesion=Decimal('20.00'), metodo_pago='efectivo',
            activo=False, concluida=True
        )
        Asistencia.objects.create(
            matricula=otra_matricula, horario=self.horario,
            profesor=self.profesor, fecha='2024-03-01',
            hora=time(10, 30), estado='presente', es_recuperacion=True
        )
        url = f'/api/ciclos/{self.ciclo.id}/asistencias/por-horario/?horario_id={self.horario.id}&fecha=2024-03-01'
        response = self.client.get(url)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['alumno_id'], self.alumno.id)
        self.assertTrue(data[0]['es_recuperacion'])
