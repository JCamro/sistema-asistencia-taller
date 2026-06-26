"""
Seed command: datos demo variados para probar Mis Alumnos.

Escenarios:
- 1 matricula activa (distintas tasas: 100%, 75%, 50%, 25%, 0%)
- 2 matriculas activas (viene 2x/semana)
- 3 matriculas activas (viene 3x/semana)
- Multiples historicas del mismo taller (prueba agrupacion)
- Activa + historicas mismo taller
- Sin asistencias (recien matriculado)
- Solo historicas (sin activa)

Uso: python manage.py seed_alumnos_demo [--profesor-dni=12345678]
"""

from datetime import date, time, timedelta
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone
from core.models import (
    Ciclo, Profesor, Alumno,
    Taller, Horario, Matricula,
    MatriculaHorario, Asistencia,
)


class Command(BaseCommand):
    help = 'Generar datos demo variados para Mis Alumnos'

    def add_arguments(self, parser):
        parser.add_argument('--profesor-dni', default='12345678')

    def handle(self, *args, **options):
        profesor_dni = options['profesor_dni']
        hoy = date.today()

        # ── Ciclo ────────────────────────────────────────────────────
        ciclo, _ = Ciclo.objects.get_or_create(
            nombre='Verano 2026',
            defaults={'tipo': 'verano', 'fecha_inicio': date(2026,1,5),
                      'fecha_fin': date(2026,3,15), 'activo': True},
        )
        self.stdout.write(f'Ciclo: {ciclo.nombre}')

        # ── Profesor ─────────────────────────────────────────────────
        profesor, _ = Profesor.objects.get_or_create(
            ciclo=ciclo, dni=profesor_dni,
            defaults={'nombre':'Carlos','apellido':'Mendoza',
                      'telefono':'999888777','email':'carlos@elguera.pe','activo':True},
        )
        self.stdout.write(f'Profesor: {profesor} (DNI: {profesor_dni})')

        # ── Talleres (5) ─────────────────────────────────────────────
        talleres_data = [
            ('Guitarra', 'instrumento'),
            ('Canto', 'instrumento'),
            ('Piano', 'instrumento'),
            ('Teoria Musical', 'taller'),
            ('Ensamble', 'taller'),
        ]
        talleres = {}
        for nombre, tipo in talleres_data:
            t, _ = Taller.objects.get_or_create(ciclo=ciclo, nombre=nombre,
                                                 defaults={'tipo':tipo,'activo':True})
            talleres[nombre] = t
            self.stdout.write(f'  Taller: {t.nombre}')

        # ── Horarios (8) ─────────────────────────────────────────────
        G = talleres['Guitarra'];     C = talleres['Canto']
        P = talleres['Piano'];        T = talleres['Teoria Musical']
        E = talleres['Ensamble']

        def crear_h(taller, dia, hi, hf):
            h, _ = Horario.objects.get_or_create(
                ciclo=ciclo, taller=taller, profesor=profesor,
                dia_semana=dia, hora_inicio=hi, hora_fin=hf,
                defaults={'tipo_pago':'dinamico','cupo_maximo':10,'activo':True})
            return h

        hG_L = crear_h(G, 0, time(14,0), time(15,0))   # Guitarra Lun 14-15
        hG_X = crear_h(G, 2, time(14,0), time(15,0))   # Guitarra Mie 14-15
        hC_M = crear_h(C, 1, time(16,0), time(17,0))   # Canto Mar 16-17
        hC_J = crear_h(C, 3, time(16,0), time(17,0))   # Canto Jue 16-17
        hP_L = crear_h(P, 0, time(10,0), time(11,0))   # Piano Lun 10-11
        hP_X = crear_h(P, 2, time(10,0), time(11,0))   # Piano Mie 10-11
        hT_V = crear_h(T, 4, time(10,0), time(11,0))   # Teoria Vie 10-11
        hE_S = crear_h(E, 5, time(11,0), time(12,0))   # Ensamble Sab 11-12

        self.stdout.write(f'  8 horarios creados')

        # ── Alumnos (18) ────────────────────────────────────────────
        alumnos_data = [
            ('11111111','Lucia','Ramirez','999111001'),
            ('22222222','Mateo','Vargas','999222002'),
            ('33333333','Valentina','Flores','999333003'),
            ('44444444','Santiago','Rojas','999444004'),
            ('55555555','Camila','Torres','999555005'),
            ('66666666','Benjamin','Cruz','999666006'),
            ('77777777','Isabella','Medina','999777007'),
            ('88888888','Sebastian','Guzman','999888008'),
            ('99999999','Sofia','Castillo','999999009'),
            ('10101010','Daniel','Morales','999101010'),
            ('12121212','Emma','Ortiz','999121212'),
            ('13131313','Nicolas','Reyes','999131313'),
            ('14141414','Martina','Paz','999141414'),
            ('15151515','Joaquin','Luna','999151515'),
            ('16161616','Renata','Silva','999161616'),
            ('17171717','Thiago','Perez','999171717'),
            ('18181818','Olivia','Diaz','999181818'),
            ('19191919','Gael','Herrera','999191919'),
        ]
        alumnos = {}
        for dni, nombre, apellido, tel in alumnos_data:
            a, _ = Alumno.objects.get_or_create(
                ciclo=ciclo, dni=dni,
                defaults={'nombre':nombre,'apellido':apellido,'telefono':tel,
                          'email':f'{nombre.lower()}.{apellido.lower()}@demo.pe','activo':True})
            alumnos[dni] = a
        self.stdout.write(f'  {len(alumnos)} alumnos creados')

        # ── Helpers ─────────────────────────────────────────────────
        def ultimo_dia(dia_semana, desde=hoy):
            offset = (desde.weekday() - dia_semana) % 7
            return desde - timedelta(days=offset)

        # Ultimas 4 semanas de cada dia
        sem = lambda d: [ultimo_dia(d) - timedelta(weeks=w) for w in range(4,0,-1)]
        LUN, MAR, MIE, JUE, VIE, SAB = sem(0), sem(1), sem(2), sem(3), sem(4), sem(5)

        def mat(alumno_dni, taller, sesiones, **kw):
            a = alumnos[alumno_dni]
            filtro = {'alumno':a,'ciclo':ciclo,'taller':taller}
            for k in ['activo','concluida']:
                if k in kw: filtro[k] = kw[k]
            ex = Matricula.objects.filter(**filtro).first()
            if ex: return ex
            return Matricula.objects.create(
                alumno=a, ciclo=ciclo, taller=taller,
                sesiones_contratadas=sesiones,
                precio_total=sesiones*20, precio_por_sesion=20,
                metodo_pago='efectivo', **kw)

        def vinc(matr, horario):
            MatriculaHorario.objects.get_or_create(matricula=matr, horario=horario)

        def asist(matr, horario, fechas, estados):
            for f, e in zip(fechas, estados):
                Asistencia.objects.get_or_create(
                    matricula=matr, horario=horario, profesor=profesor,
                    fecha=f, defaults={'hora':horario.hora_inicio,'estado':e})

        # ─────────────────────────────────────────────────────────────
        # 1. Lucia — Guitarra LUN, 1 activa, 100%
        # ─────────────────────────────────────────────────────────────
        m = mat('11111111', G, 12); vinc(m, hG_L)
        asist(m, hG_L, LUN, ['asistio']*4)
        self.stdout.write('  Lucia: Guitarra Lun, 1 activa, 100%')

        # 2. Mateo — Guitarra MIE, 1 activa, 75%
        m = mat('22222222', G, 12); vinc(m, hG_X)
        asist(m, hG_X, MIE, ['asistio','asistio','falta','asistio'])
        self.stdout.write('  Mateo: Guitarra Mie, 1 activa, 75%')

        # 3. Valentina — Canto MAR, 1 activa, 25%
        m = mat('33333333', C, 12); vinc(m, hC_M)
        asist(m, hC_M, MAR, ['asistio','falta','falta_grave','falta'])
        self.stdout.write('  Valentina: Canto Mar, 1 activa, 25% (falta_grave)')

        # 4. Santiago — Piano LUN, 1 activa, 50%
        m = mat('44444444', P, 8); vinc(m, hP_L)
        asist(m, hP_L, LUN, ['asistio','falta','asistio','falta'])
        self.stdout.write('  Santiago: Piano Lun, 1 activa, 50%')

        # 5. Camila — Teoria VIE, 1 activa, 100%
        m = mat('55555555', T, 8); vinc(m, hT_V)
        asist(m, hT_V, VIE, ['asistio']*4)
        self.stdout.write('  Camila: Teoria Vie, 1 activa, 100%')

        # 6. Benjamin — Ensamble SAB, 1 activa, 0 asistencias
        m = mat('66666666', E, 12); vinc(m, hE_S)
        self.stdout.write('  Benjamin: Ensamble Sab, 1 activa, 0 asist (recien)')

        # ─────────────────────────────────────────────────────────────
        # 7. Daniel — 3 ACTIVAS (Guitarra LUN + Canto MAR + Piano MIE)
        # ─────────────────────────────────────────────────────────────
        m1 = mat('10101010', G, 12); vinc(m1, hG_L)
        asist(m1, hG_L, LUN, ['asistio','asistio','falta','asistio'])
        m2 = mat('10101010', C, 8); vinc(m2, hC_M)
        asist(m2, hC_M, MAR, ['asistio','asistio'])
        m3 = mat('10101010', P, 12); vinc(m3, hP_X)
        asist(m3, hP_X, MIE, ['asistio','asistio','asistio'])
        self.stdout.write('  Daniel: 3 activas (Guitarra+Canto+Piano), dropdown 3 talleres')

        # 8. Emma — 2 ACTIVAS (Guitarra MIE + Ensamble SAB)
        m1 = mat('12121212', G, 12); vinc(m1, hG_X)
        asist(m1, hG_X, MIE, ['asistio','asistio','asistio','falta'])
        m2 = mat('12121212', E, 8); vinc(m2, hE_S)
        asist(m2, hE_S, SAB, ['asistio','asistio'])
        self.stdout.write('  Emma: 2 activas (Guitarra+Ensamble), dropdown 2 talleres')

        # 9. Nicolas — 1 activa Guitarra LUN + 2 HISTORICAS Guitarra
        m_act = mat('13131313', G, 12); vinc(m_act, hG_L)
        asist(m_act, hG_L, LUN, ['asistio','falta','asistio'])
        # 2 historicas Guitarra (mismo ciclo, concluidas)
        for dias_atras, ses in [(90,12),(180,8)]:
            mh = mat('13131313', G, ses, activo=True, concluida=True,
                     fecha_matricula=timezone.now()-timedelta(days=dias_atras))
            vinc(mh, hG_L)
        self.stdout.write('  Nicolas: 1 activa Guitarra + 2 historicas Guitarra (agrupacion)')

        # 10. Martina — 2 activas (Canto JUE + Teoria VIE) + 1 hist Canto
        m1 = mat('14141414', C, 12); vinc(m1, hC_J)
        asist(m1, hC_J, JUE, ['asistio','asistio','asistio','asistio'])
        m2 = mat('14141414', T, 8); vinc(m2, hT_V)
        asist(m2, hT_V, VIE, ['asistio','asistio','falta','asistio'])
        # historica Canto
        mh = mat('14141414', C, 8, activo=True, concluida=True,
                 fecha_matricula=timezone.now()-timedelta(days=100))
        vinc(mh, hC_J)
        self.stdout.write('  Martina: 2 activas (Canto+Teoria) + 1 hist Canto')

        # 11. Joaquin — 1 activa Piano MIE + 3 HISTORICAS Piano
        m_act = mat('15151515', P, 12); vinc(m_act, hP_X)
        asist(m_act, hP_X, MIE, ['asistio','asistio','falta'])
        for dias_atras in [80, 160, 240]:
            mh = mat('15151515', P, 12, activo=True, concluida=True,
                     fecha_matricula=timezone.now()-timedelta(days=dias_atras))
            vinc(mh, hP_X)
        self.stdout.write('  Joaquin: 1 activa Piano + 3 historicas Piano')

        # 12. Renata — 3 ACTIVAS (Guitarra MIE + Canto JUE + Ensamble SAB)
        m1 = mat('16161616', G, 12); vinc(m1, hG_X)
        asist(m1, hG_X, MIE, ['asistio']*4)
        m2 = mat('16161616', C, 8); vinc(m2, hC_J)
        asist(m2, hC_J, JUE, ['asistio','falta','asistio'])
        m3 = mat('16161616', E, 12); vinc(m3, hE_S)
        asist(m3, hE_S, SAB, ['asistio','asistio'])
        self.stdout.write('  Renata: 3 activas (Guitarra+Canto+Ensamble)')

        # 13. Thiago — 1 activa Piano (LUN+MIE, 2 horarios misma matricula)
        m = mat('17171717', P, 12); vinc(m, hP_L); vinc(m, hP_X)
        asist(m, hP_L, [LUN[3]], ['asistio'])
        asist(m, hP_X, [MIE[3]], ['falta'])
        self.stdout.write('  Thiago: Piano Lun+MIE, 1 matricula 2 horarios, 1 clase c/u')

        # 14. Olivia — 2 ACTIVAS (Piano LUN+MIE + Teoria VIE), 100%
        m1 = mat('18181818', P, 8); vinc(m1, hP_L); vinc(m1, hP_X)
        asist(m1, hP_L, LUN, ['asistio']*4)
        asist(m1, hP_X, MIE, ['asistio']*4)
        m2 = mat('18181818', T, 12); vinc(m2, hT_V)
        asist(m2, hT_V, VIE, ['asistio']*4)
        self.stdout.write('  Olivia: 2 activas (Piano+Teoria), 100% ambas')

        # ─────────────────────────────────────────────────────────────
        # SOLO HISTORICOS (sin activa)
        # ─────────────────────────────────────────────────────────────
        # 15. Isabella — Guitarra (historica)
        m = mat('77777777', G, 12, activo=True, concluida=True,
                fecha_matricula=timezone.now()-timedelta(days=120))
        vinc(m, hG_L)
        self.stdout.write('  Isabella: Solo hist (Guitarra)')

        # 16. Sebastian — Canto (historica)
        m = mat('88888888', C, 12, activo=True, concluida=True,
                fecha_matricula=timezone.now()-timedelta(days=120))
        vinc(m, hC_M)
        self.stdout.write('  Sebastian: Solo hist (Canto)')

        # 17. Sofia — Piano (historica)
        m = mat('99999999', P, 12, activo=True, concluida=True,
                fecha_matricula=timezone.now()-timedelta(days=120))
        vinc(m, hP_L)
        self.stdout.write('  Sofia: Solo hist (Piano)')

        # 18. Gael — 2 HISTORICAS (Ensamble + Guitarra), sin activa
        m1 = mat('19191919', E, 8, activo=True, concluida=True,
                 fecha_matricula=timezone.now()-timedelta(days=100))
        vinc(m1, hE_S)
        m2 = mat('19191919', G, 12, activo=True, concluida=True,
                 fecha_matricula=timezone.now()-timedelta(days=200))
        vinc(m2, hG_L)
        self.stdout.write('  Gael: 2 historicas (Ensamble+Guitarra), sin activa')

        # ── Resumen ─────────────────────────────────────────────────
        activas = Matricula.objects.filter(ciclo=ciclo, activo=True, concluida=False).count()
        historicas = Matricula.objects.filter(ciclo=ciclo).filter(
            Q(concluida=True) | Q(activo=False)).count()

        self.stdout.write(self.style.SUCCESS(
            f'\n{"="*60}\n'
            f'[OK] Datos demo generados.\n'
            f'   Profesor: {profesor} (DNI: {profesor_dni})\n'
            f'   Ciclo: {ciclo.nombre}\n'
            f'   Alumnos: {Alumno.objects.filter(ciclo=ciclo).count()}\n'
            f'   Matriculas activas: {activas}\n'
            f'   Matriculas historicas: {historicas}\n'
            f'\n'
            f'   Casos:\n'
            f'   - 1 activa: Lucia, Mateo, Valentina, Santiago, Camila,\n'
            f'     Benjamin (0 asist), Thiago (1 clase)\n'
            f'   - 2 activas: Emma, Martina, Olivia\n'
            f'   - 3 activas: Daniel, Renata\n'
            f'   - Multiples historicas mismo taller: Nicolas (2), Joaquin (3)\n'
            f'   - Activa + historicas: Martina, Nicolas, Joaquin\n'
            f'   - Solo historicas: Isabella, Sebastian, Sofia, Gael\n'
            f'{"="*60}'
        ))
