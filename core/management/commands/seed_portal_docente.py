from datetime import date, time, timedelta, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone as tz

from core.models import (
    Ciclo, Profesor, Taller, Horario, Alumno,
    Matricula, MatriculaHorario, Asistencia, NotaClase,
)
from core.models.hora_trabajada import HoraTrabajada


class Command(BaseCommand):
    help = "Seed test data for portal-docente (profesores with alphanumeric DNI, horarios, asistencias, horas_trabajadas, notas)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete existing portal-docente test data before seeding",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._clean()

        self.stdout.write("Seeding portal-docente test data...")

        # ------------------------------------------------------------------
        # 1. Ciclo (reuse ciclo 1 if it exists, otherwise create one)
        # ------------------------------------------------------------------
        ciclo = Ciclo.objects.filter(id=1).first()
        if not ciclo:
            ciclo = Ciclo.objects.create(
                nombre="Ciclo Portal Docente",
                tipo="anual",
                fecha_inicio=date(2026, 3, 1),
                fecha_fin=date(2026, 12, 15),
                activo=True,
            )
            self.stdout.write(f"  Created ciclo: {ciclo}")
        else:
            self.stdout.write(f"  Using existing ciclo: {ciclo} (id={ciclo.id})")

        # ------------------------------------------------------------------
        # 2. Profesores with alphanumeric DNI
        # ------------------------------------------------------------------
        profesores_data = [
            {"dni": "ABC12345", "nombre": "Maria Elena", "apellido": "Rios García",
             "email": "maria.rios@test.com", "telefono": "987654321"},
            {"dni": "PROF001", "nombre": "Carlos Andrés", "apellido": "Vega López",
             "email": "carlos.vega@test.com", "telefono": "912345678"},
            {"dni": "TEACH99", "nombre": "Ana Sofía", "apellido": "Delgado Martín",
             "email": "ana.delgado@test.com", "telefono": "955667788"},
        ]

        profesores = {}
        for pd in profesores_data:
            prof, created = Profesor.objects.update_or_create(
                ciclo=ciclo,
                dni=pd["dni"],
                defaults={
                    "nombre": pd["nombre"],
                    "apellido": pd["apellido"],
                    "email": pd["email"],
                    "telefono": pd["telefono"],
                    "activo": True,
                },
            )
            profesores[pd["dni"]] = prof
            tag = "Created" if created else "Updated"
            self.stdout.write(f"  {tag} profesor: {prof} (DNI={prof.dni}, id={prof.id})")

        # ------------------------------------------------------------------
        # 3. Talleres (reuse existing in ciclo, create if missing)
        # ------------------------------------------------------------------
        talleres_data = [
            {"nombre": "Violín", "tipo": "instrumento", "descripcion": "Taller de violín para portal docente"},
            {"nombre": "Batería", "tipo": "instrumento", "descripcion": "Taller de batería para portal docente"},
            {"nombre": "Coro", "tipo": "taller", "descripcion": "Taller de coro para portal docente"},
        ]

        talleres = {}
        for td in talleres_data:
            taller, created = Taller.objects.update_or_create(
                ciclo=ciclo,
                nombre=td["nombre"],
                defaults={
                    "tipo": td["tipo"],
                    "descripcion": td["descripcion"],
                    "activo": True,
                },
            )
            talleres[td["nombre"]] = taller
            tag = "Created" if created else "Updated"
            self.stdout.write(f"  {tag} taller: {taller} (id={taller.id})")

        # Also grab existing talleres in ciclo 1 for variety
        existing_talleres = list(Taller.objects.filter(ciclo=ciclo, activo=True))
        all_talleres = list(talleres.values()) + [t for t in existing_talleres if t.nombre not in talleres]

        # ------------------------------------------------------------------
        # 4. Horarios — 8 horarios spread across profesores and days
        # ------------------------------------------------------------------
        horarios_data = [
            # (profesor_dni, taller_nombre, dia_semana, hora_inicio, hora_fin, tipo_pago)
            ("ABC12345", "Violín", 0, time(8, 0), time(9, 0), "dinamico"),
            ("ABC12345", "Violín", 2, time(8, 0), time(9, 0), "dinamico"),
            ("ABC12345", "Batería", 4, time(10, 0), time(11, 0), "dinamico"),
            ("PROF001", "Coro", 1, time(14, 0), time(15, 30), "fijo"),
            ("PROF001", "Coro", 3, time(14, 0), time(15, 30), "fijo"),
            ("PROF001", "Guitarra", 5, time(9, 0), time(10, 0), "dinamico"),
            ("TEACH99", "Batería", 0, time(16, 0), time(17, 0), "dinamico"),
            ("TEACH99", "Violín", 3, time(11, 0), time(12, 0), "dinamico"),
        ]

        horarios = []
        for dni, taller_nombre, dia, hi, hf, tp in horarios_data:
            prof = profesores[dni]
            taller = talleres.get(taller_nombre) or Taller.objects.get(ciclo=ciclo, nombre=taller_nombre)
            horario, created = Horario.objects.update_or_create(
                ciclo=ciclo,
                taller=taller,
                profesor=prof,
                dia_semana=dia,
                hora_inicio=hi,
                defaults={
                    "hora_fin": hf,
                    "tipo_pago": tp,
                    "cupo_maximo": 12,
                    "activo": True,
                    "monto_fijo": Decimal("25.00") if tp == "fijo" else None,
                },
            )
            horarios.append(horario)
            tag = "Created" if created else "Updated"
            self.stdout.write(f"  {tag} horario: {horario} (id={horario.id})")

        # ------------------------------------------------------------------
        # 5. Matriculas + MatriculaHorario (link alumnos to horarios)
        # ------------------------------------------------------------------
        # Get some alumnos from ciclo 1
        alumnos_ciclo1 = list(Alumno.objects.filter(ciclo=ciclo, activo=True)[:8])
        if len(alumnos_ciclo1) < 4:
            self.stdout.write(self.style.WARNING("  Not enough alumnos in ciclo 1, skipping matriculas/asistencias"))
            alumnos_ciclo1 = []

        matriculas_by_taller = {}
        for taller in all_talleres[:3]:
            for alumno in alumnos_ciclo1[:4]:
                mat, created = Matricula.objects.get_or_create(
                    alumno=alumno,
                    ciclo=ciclo,
                    taller=taller,
                    defaults={
                        "sesiones_contratadas": 12,
                        "precio_total": Decimal("200.00"),
                        "precio_por_sesion": Decimal("16.67"),
                        "metodo_pago": "efectivo",
                        "fecha_matricula": tz.make_aware(datetime(2026, 4, 1, 10, 0, 0)),
                        "activo": True,
                        "concluida": False,
                    },
                )
                matriculas_by_taller.setdefault(taller.id, []).append(mat)
                if created:
                    self.stdout.write(f"    Matricula: {mat} (id={mat.id})")

        # Link matriculas to horarios via MatriculaHorario
        mh_created = 0
        for horario in horarios:
            mats = matriculas_by_taller.get(horario.taller_id, [])
            for mat in mats[:3]:  # up to 3 alumnos per horario
                _, created = MatriculaHorario.objects.get_or_create(
                    matricula=mat,
                    horario=horario,
                )
                if created:
                    mh_created += 1
        self.stdout.write(f"  Created {mh_created} MatriculaHorario links")

        # ------------------------------------------------------------------
        # 6. Asistencias — for the last 4 Mondays/Mondays/etc (past dates)
        # ------------------------------------------------------------------
        # Use dates that are on the correct day-of-week for each horario
        asistencias_created = 0
        base_date = date(2026, 5, 1)  # Start from May 2026

        for horario in horarios:
            # Find the next occurrence of horario.dia_semana from base_date
            days_ahead = horario.dia_semana - base_date.weekday()
            if days_ahead < 0:
                days_ahead += 7
            first_class_date = base_date + timedelta(days=days_ahead)

            # Create 4 weekly sessions
            for week in range(4):
                class_date = first_class_date + timedelta(weeks=week)
                mats = matriculas_by_taller.get(horario.taller_id, [])

                for i, mat in enumerate(mats[:3]):
                    # Vary states: mostly asistio, some falta
                    if i == 2 and week == 1:
                        estado = "falta"
                    elif i == 1 and week == 3:
                        estado = "falta_grave"
                    else:
                        estado = "asistio"

                    _, created = Asistencia.objects.get_or_create(
                        matricula=mat,
                        horario=horario,
                        fecha=class_date,
                        defaults={
                            "profesor": horario.profesor,
                            "hora": horario.hora_inicio,
                            "estado": estado,
                        },
                    )
                    if created:
                        asistencias_created += 1

        self.stdout.write(f"  Created {asistencias_created} asistencias")

        # ------------------------------------------------------------------
        # 7. HorasTrabajadas — 8 records across profesores
        # ------------------------------------------------------------------
        ht_created = 0
        for horario in horarios:
            base_date_ht = date(2026, 5, 1)
            days_ahead = horario.dia_semana - base_date_ht.weekday()
            if days_ahead < 0:
                days_ahead += 7
            first_class_date = base_date_ht + timedelta(days=days_ahead)

            for week in range(2):  # 2 weeks of horas_trabajadas
                class_date = first_class_date + timedelta(weeks=week)
                num_alumnos = min(3, len(matriculas_by_taller.get(horario.taller_id, [])))

                # Calculate payment like the real system
                if num_alumnos == 0:
                    monto_prof = Decimal("0")
                    valor_gen = Decimal("0")
                elif num_alumnos == 1:
                    monto_prof = Decimal("17.00")
                    valor_gen = Decimal("17.00")
                else:
                    base = Decimal("17.00")
                    additional = (num_alumnos - 1) * Decimal("8.50")  # 50% of 17
                    monto_prof = min(base + additional, Decimal("35.00"))
                    valor_gen = monto_prof

                _, created = HoraTrabajada.objects.get_or_create(
                    profesor=horario.profesor,
                    horario=horario,
                    fecha=class_date,
                    tipo="clase_regular",
                    defaults={
                        "ciclo": ciclo,
                        "horas_trabajadas": Decimal("1.00"),
                        "estado": "aprobada" if week == 0 else "pendiente",
                        "num_alumnos": num_alumnos,
                        "valor_generado": valor_gen,
                        "monto_base": Decimal("17.00") if num_alumnos > 0 else Decimal("0"),
                        "monto_adicional": valor_gen - Decimal("17.00") if num_alumnos > 1 else Decimal("0"),
                        "monto_profesor": monto_prof,
                        "ganancia_taller": Decimal("0"),
                        "created_from": "admin_manual",
                    },
                )
                if created:
                    ht_created += 1

        self.stdout.write(f"  Created {ht_created} horas_trabajadas")

        # ------------------------------------------------------------------
        # 8. NotasClase — 1 per horario for the first date
        # ------------------------------------------------------------------
        notas_created = 0
        notas_textos = [
            "Clase introductoria. Se cubrieron fundamentos básicos y postura.",
            "Ejercicios de respiración y técnica. Buen avance grupal.",
            "Repaso de escalas. Se asignaron ejercicios para la próxima clase.",
            "Práctica de piezas. Los alumnos mostraron buen progreso.",
            "Evaluación parcial. Resultados satisfactorios en general.",
            "Clase de conjunto. Se trabajó armonía y sincronización.",
            "Técnica avanzada. Algunos alumnos necesitan más práctica.",
            "Ensayo general. Preparación para presentación del ciclo.",
        ]

        for i, horario in enumerate(horarios):
            base_date_n = date(2026, 5, 1)
            days_ahead = horario.dia_semana - base_date_n.weekday()
            if days_ahead < 0:
                days_ahead += 7
            class_date = base_date_n + timedelta(days=days_ahead)

            _, created = NotaClase.objects.get_or_create(
                profesor=horario.profesor,
                horario=horario,
                fecha=class_date,
                defaults={
                    "ciclo": ciclo,
                    "contenido": notas_textos[i % len(notas_textos)],
                },
            )
            if created:
                notas_created += 1

        self.stdout.write(f"  Created {notas_created} notas_clase")

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("PORTAL-DOCENTE TEST DATA — READY"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write("Profesores (use these DNI to login):")
        for dni, prof in profesores.items():
            self.stdout.write(f"  DNI: {dni:12s}  ->  {prof.apellido}, {prof.nombre}  (id={prof.id})")
        self.stdout.write("")
        self.stdout.write(f"Ciclo: {ciclo.nombre} (id={ciclo.id})")
        self.stdout.write(f"Horarios: {len(horarios)}")
        self.stdout.write(f"Asistencias created: {asistencias_created}")
        self.stdout.write(f"HorasTrabajadas created: {ht_created}")
        self.stdout.write(f"NotasClase created: {notas_created}")
        self.stdout.write("")
        self.stdout.write("Login endpoint: POST /api/portal-docente/auth/login/")
        self.stdout.write('Body: {"dni": "ABC12345"}')
        self.stdout.write("")

    def _clean(self):
        """Remove portal-docente test data (by DNI prefix)."""
        self.stdout.write("Cleaning portal-docente test data...")
        test_dnis = ["ABC12345", "PROF001", "TEACH99"]
        profesores = Profesor.objects.filter(dni__in=test_dnis)

        # Delete related data
        horas = HoraTrabajada.objects.filter(profesor__in=profesores)
        horas_count = horas.count()
        horas.delete()

        notas = NotaClase.objects.filter(profesor__in=profesores)
        notas_count = notas.count()
        notas.delete()

        # Delete horarios (cascades to asistencias)
        horarios = Horario.objects.filter(profesor__in=profesores)
        horarios_count = horarios.count()
        horarios.delete()

        prof_count = profesores.count()
        profesores.delete()

        self.stdout.write(f"  Deleted: {prof_count} profesores, {horarios_count} horarios, "
                          f"{horas_count} horas_trabajadas, {notas_count} notas_clase")

