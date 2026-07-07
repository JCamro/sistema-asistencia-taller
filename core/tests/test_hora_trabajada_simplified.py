"""
Tests for Horas Trabajadas — simplified module.
"""
from datetime import date, time
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User

from core.models import (
    Ciclo, Profesor, Alumno, Taller, Horario, Matricula,
    MatriculaHorario, Asistencia, HoraTrabajada,
)


class TestHoraTrabajadaSignal(TestCase):
    """Auto-generation of HoraTrabajada when Asistencia is saved."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(nombre="2026-T", tipo="anual", fecha_inicio=date(2026,1,1), fecha_fin=date(2026,12,31))
        self.profesor = Profesor.objects.create(ciclo=self.ciclo, nombre="Carlos", apellido="Lopez", dni="11111111", activo=True)
        self.taller = Taller.objects.create(ciclo=self.ciclo, nombre="Guitarra", tipo="instrumento", activo=True)
        self.horario = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller, profesor=self.profesor,
            dia_semana=1, hora_inicio=time(10,0), hora_fin=time(11,0),
            cupo_maximo=10, tipo_pago="dinamico", activo=True,
        )
        self.alumno = Alumno.objects.create(ciclo=self.ciclo, nombre="Pedro", apellido="Ramirez", dni="33333333", activo=True)
        self.matricula = Matricula.objects.create(
            alumno=self.alumno, ciclo=self.ciclo, taller=self.taller,
            sesiones_contratadas=12, precio_total=Decimal("200"), precio_por_sesion=Decimal("16.67"),
            metodo_pago="efectivo", activo=True,
        )
        MatriculaHorario.objects.create(matricula=self.matricula, horario=self.horario)

    def test_attendance_creates_hora_trabajada(self):
        """Saving an asistencia with estado='asistio' creates a HoraTrabajada."""
        self.assertEqual(HoraTrabajada.objects.count(), 0)

        Asistencia.objects.create(
            matricula=self.matricula, horario=self.horario, profesor=self.profesor,
            fecha=date(2026, 6, 15), hora=time(10,0), estado="asistio",
        )

        self.assertEqual(HoraTrabajada.objects.count(), 1)
        ht = HoraTrabajada.objects.first()
        self.assertEqual(ht.profesor, self.profesor)
        self.assertEqual(ht.horario, self.horario)
        self.assertEqual(ht.fecha, date(2026, 6, 15))
        self.assertEqual(ht.num_alumnos, 1)
        self.assertEqual(ht.tipo, "clase_regular")
        self.assertEqual(ht.estado, "aprobada")
        self.assertEqual(ht.created_from, "asistencia_auto")

    def test_attendance_falta_does_not_create(self):
        """Falta does NOT create HoraTrabajada."""
        Asistencia.objects.create(
            matricula=self.matricula, horario=self.horario, profesor=self.profesor,
            fecha=date(2026, 6, 15), hora=time(10,0), estado="falta",
        )
        self.assertEqual(HoraTrabajada.objects.count(), 0)

    def test_multiple_attendance_updates_count(self):
        """Two asistencias on same (horario, fecha) update num_alumnos."""
        a2 = Alumno.objects.create(ciclo=self.ciclo, nombre="Ana", apellido="Torres", dni="44444444", activo=True)
        m2 = Matricula.objects.create(
            alumno=a2, ciclo=self.ciclo, taller=self.taller,
            sesiones_contratadas=12, precio_total=Decimal("200"), precio_por_sesion=Decimal("16.67"),
            metodo_pago="efectivo", activo=True,
        )
        MatriculaHorario.objects.create(matricula=m2, horario=self.horario)

        Asistencia.objects.create(
            matricula=self.matricula, horario=self.horario, profesor=self.profesor,
            fecha=date(2026, 6, 15), hora=time(10,0), estado="asistio",
        )
        Asistencia.objects.create(
            matricula=m2, horario=self.horario, profesor=self.profesor,
            fecha=date(2026, 6, 15), hora=time(10,0), estado="asistio",
        )

        ht = HoraTrabajada.objects.first()
        self.assertEqual(ht.num_alumnos, 2)


class TestHoraTrabajadaAPI(TestCase):
    """Manual CRUD via API."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(nombre="2026-T", tipo="anual", fecha_inicio=date(2026,1,1), fecha_fin=date(2026,12,31))
        self.profesor = Profesor.objects.create(ciclo=self.ciclo, nombre="Carlos", apellido="Lopez", dni="11111111", activo=True)
        self.taller = Taller.objects.create(ciclo=self.ciclo, nombre="Guitarra", tipo="instrumento", activo=True)
        self.horario = Horario.objects.create(
            ciclo=self.ciclo, taller=self.taller, profesor=self.profesor,
            dia_semana=1, hora_inicio=time(10,0), hora_fin=time(11,0),
            cupo_maximo=10, tipo_pago="dinamico", activo=True,
        )
        self.user = User.objects.create_user(username="test", password="test")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_manual_hora_trabajada(self):
        """POST creates a manual HoraTrabajada."""
        response = self.client.post(
            "/api/horas-trabajadas/",
            {
                "profesor": self.profesor.id,
                "ciclo": self.ciclo.id,
                "horario": self.horario.id,
                "fecha": "2026-06-15",
                "horas_trabajadas": 1,
                "monto_profesor": 50.00,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ht = HoraTrabajada.objects.get(fecha=date(2026, 6, 15))
        self.assertEqual(ht.profesor, self.profesor)
        self.assertEqual(ht.created_from, "admin_manual")
        self.assertEqual(ht.estado, "aprobada")
        self.assertEqual(ht.monto_profesor, 50.00)

    def test_create_rejects_mismatched_profesor(self):
        """POST fails if profesor doesn't match horario's profesor."""
        otro = Profesor.objects.create(ciclo=self.ciclo, nombre="Maria", apellido="Garcia", dni="22222222", activo=True)
        response = self.client.post(
            "/api/horas-trabajadas/",
            {
                "profesor": otro.id,
                "ciclo": self.ciclo.id,
                "horario": self.horario.id,
                "fecha": "2026-06-15",
                "num_alumnos": 1,
                "horas_trabajadas": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_horas_trabajadas(self):
        """GET returns paginated list."""
        HoraTrabajada.objects.create(
            profesor=self.profesor, ciclo=self.ciclo, horario=self.horario,
            fecha=date(2026, 6, 15), num_alumnos=2, estado="aprobada", created_from="admin_manual",
        )
        response = self.client.get(f"/api/ciclos/{self.ciclo.id}/horas-trabajadas/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 1)
