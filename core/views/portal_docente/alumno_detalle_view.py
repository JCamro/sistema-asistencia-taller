from django.http import Http404
from django.db import models
from django.db.models import Count, Q, Prefetch, Subquery, OuterRef
from collections import defaultdict

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Alumno, Matricula, MatriculaHorario, Asistencia
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo
from core.serializers.portal_docente.serializers import AlumnoDetalleSerializer


class ProfesorAlumnoDetalleView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/alumnos/{alumno_id}/detalle/

    Returns a consolidated student detail with:
    - matricula_activa (or talleres_activos list if multiple active)
    - matriculas_historicas list
    - estadisticas (tasa_asistencia, total_asistencias, total_faltas)

    Query params:
        ?taller_id=X  — resolve active matricula to a specific taller
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id, alumno_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)
        taller_id = request.query_params.get('taller_id')

        # ── Ownership check ────────────────────────────────────────────
        has_access = Alumno.objects.filter(
            id=alumno_id,
            ciclo_id=ciclo_id,
            matriculas__horarios__horario__profesor_id=profesor_id,
            matriculas__horarios__horario__ciclo_id=ciclo_id,
            matriculas__horarios__horario__activo=True,
        ).exists()

        if not has_access:
            raise Http404('Alumno no encontrado')

        # ── Alumno basic data ──────────────────────────────────────────
        alumno = Alumno.objects.get(id=alumno_id, ciclo_id=ciclo_id)

        # ── Matriculas ─────────────────────────────────────────────────
        # Annotate each matricula with sesiones_consumidas count
        # NOTE: using _sesiones_consumidas to avoid collision with @property on model
        # Use Subquery to avoid count duplication from multiple MatriculaHorario rows
        asistencias_count_subquery = Asistencia.objects.filter(
            matricula=OuterRef('pk'),
            estado__in=['asistio', 'falta_grave'],
        ).order_by().values('matricula').annotate(cnt=Count('id')).values('cnt')

        matriculas = Matricula.objects.filter(
            alumno_id=alumno_id,
            ciclo_id=ciclo_id,
            horarios__horario__profesor_id=profesor_id,
            horarios__horario__ciclo_id=ciclo_id,
            horarios__horario__activo=True,
        ).distinct().annotate(
            _sesiones_consumidas=Subquery(asistencias_count_subquery, output_field=models.IntegerField()),
        ).select_related('taller').prefetch_related(
            Prefetch(
                'horarios',
                queryset=MatriculaHorario.objects.select_related('horario__taller'),
            ),
        ).order_by('-fecha_matricula')

        # Separate active vs historical
        activas = [m for m in matriculas if m.activo and not m.concluida]
        historicas = [m for m in matriculas if not (m.activo and not m.concluida)]

        # ── Active matricula resolution ────────────────────────────────
        matricula_activa = None
        talleres_activos = None

        if taller_id:
            # Resolve to specific taller
            for m in activas:
                if m.taller_id == int(taller_id):
                    matricula_activa = m
                    break
        elif len(activas) == 1:
            matricula_activa = activas[0]
        elif len(activas) > 1:
            seen_talleres = set()
            talleres_activos = []
            for m in activas:
                if m.taller_id not in seen_talleres:
                    seen_talleres.add(m.taller_id)
                    talleres_activos.append({
                        'matricula_id': m.id,
                        'taller_id': m.taller_id,
                        'taller_nombre': m.taller.nombre,
                    })

        # ── Build response ─────────────────────────────────────────────
        alumno_data = {
            'id': alumno.id,
            'nombre': alumno.nombre,
            'apellido': alumno.apellido,
            'dni': alumno.dni,
            'telefono': alumno.telefono or '',
            'email': alumno.email or '',
        }

        # Build matricula_activa data
        matricula_activa_data = None
        if matricula_activa is not None:
            # Get ALL horarios for this matricula (can be Lunes+Miercoles+Viernes)
            mh_list = list(matricula_activa.horarios.all().select_related('horario'))
            horarios_data = []
            for mh in mh_list:
                h = mh.horario
                horarios_data.append({
                    'horario_id': h.id,
                    'dia_semana': h.dia_semana,
                    'hora_inicio': str(h.hora_inicio),
                    'hora_fin': str(h.hora_fin),
                })

            # First horario for backward compat
            primer_h = mh_list[0].horario if mh_list else None

            # Get asistencias for this active matricula
            asistencias_qs = Asistencia.objects.filter(
                matricula=matricula_activa,
            ).select_related('horario').order_by('-fecha', '-hora')[:20]

            matricula_activa_data = {
                'id': matricula_activa.id,
                'horario_id': primer_h.id if primer_h else None,
                'taller_id': matricula_activa.taller_id,
                'taller_nombre': matricula_activa.taller.nombre,
                'horarios': horarios_data,
                'dia_semana': primer_h.dia_semana if primer_h else None,
                'hora_inicio': str(primer_h.hora_inicio) if primer_h else None,
                'hora_fin': str(primer_h.hora_fin) if primer_h else None,
                'sesiones_contratadas': matricula_activa.sesiones_contratadas,
                'sesiones_consumidas': matricula_activa._sesiones_consumidas,
                'sesiones_disponibles': max(
                    0,
                    matricula_activa.sesiones_contratadas - matricula_activa._sesiones_consumidas,
                ),
                'precio_por_sesion': str(matricula_activa.precio_por_sesion),
                'asistencias': [
                    {
                        'fecha': a.fecha.isoformat(),
                        'estado': a.estado,
                        'hora': str(a.hora),
                        'horario_inicio': str(a.horario.hora_inicio) if a.horario else None,
                        'horario_fin': str(a.horario.hora_fin) if a.horario else None,
                        'dia_semana': a.horario.dia_semana if a.horario else None,
                    }
                    for a in asistencias_qs
                ],
            }

        # Build historical matriculas with asistencias (single query for all)
        matriculas_historicas_data = []
        if historicas:
            historico_ids = [m.id for m in historicas]
            todas_asistencias_hist = Asistencia.objects.filter(
                matricula_id__in=historico_ids,
            ).order_by('-fecha', '-hora')

            # Group by matricula_id, keep max 20 per matricula
            asist_por_matricula = defaultdict(list)
            for a in todas_asistencias_hist:
                if len(asist_por_matricula[a.matricula_id]) < 20:
                    asist_por_matricula[a.matricula_id].append(a)

            for m in historicas:
                # Get schedule from first MatriculaHorario
                mh = m.horarios.first()
                horario_m = mh.horario if mh else None
                matriculas_historicas_data.append({
                    'id': m.id,
                    'taller_id': m.taller_id,
                    'taller_nombre': m.taller.nombre,
                    'fecha_matricula': m.fecha_matricula.strftime('%Y-%m-%d'),
                    'dia_semana': horario_m.dia_semana if horario_m else None,
                    'hora_inicio': str(horario_m.hora_inicio) if horario_m else None,
                    'hora_fin': str(horario_m.hora_fin) if horario_m else None,
                    'sesiones_contratadas': m.sesiones_contratadas,
                    'sesiones_consumidas': m._sesiones_consumidas,
                    'concluida': m.concluida,
                    'asistencias': [
                        {
                            'fecha': a.fecha.isoformat(),
                            'estado': a.estado,
                            'hora': str(a.hora),
                        }
                        for a in asist_por_matricula.get(m.id, [])
                    ],
                })

        # ── Statistics ───────────────────────────────────────────────────
        # If taller_id is provided: stats for that specific taller
        # If not: per-active-taller breakdown (not a global sum)
        estadisticas = None
        estadisticas_por_taller = None

        if taller_id:
            # Focused stats for the selected taller — filter by docente's matrículas only
            matriculas_taller = [m.id for m in activas if m.taller_id == int(taller_id)]
            if not matriculas_taller:
                matriculas_taller = [m.id for m in historicas if m.taller_id == int(taller_id)]
            stats = Asistencia.objects.filter(
                matricula_id__in=matriculas_taller,
            ).aggregate(
                total_asistencias=Count('id', filter=Q(estado='asistio')),
                total_faltas=Count('id', filter=Q(estado__in=['falta', 'falta_grave'])),
            )
            total_asistencias = stats['total_asistencias'] or 0
            total_faltas = stats['total_faltas'] or 0
            total_sesiones = total_asistencias + total_faltas
            tasa = round((total_asistencias / total_sesiones) * 100, 1) if total_sesiones > 0 else 0.0
            estadisticas = {
                'tasa_asistencia': tasa,
                'total_asistencias': total_asistencias,
                'total_faltas': total_faltas,
            }
        else:
            # Per-active-taller breakdown (not a global sum)
            taller_stats = []
            for m in activas:
                s = Asistencia.objects.filter(
                    matricula_id=m.id,
                ).aggregate(
                    total_asistencias=Count('id', filter=Q(estado='asistio')),
                    total_faltas=Count('id', filter=Q(estado__in=['falta', 'falta_grave'])),
                )
                ta = s['total_asistencias'] or 0
                tf = s['total_faltas'] or 0
                ts = ta + tf
                tasa = round((ta / ts) * 100, 1) if ts > 0 else 0.0
                taller_stats.append({
                    'taller_id': m.taller_id,
                    'taller_nombre': m.taller.nombre,
                    'tasa_asistencia': tasa,
                    'total_asistencias': ta,
                    'total_faltas': tf,
                })
            estadisticas_por_taller = taller_stats

        # ── Assemble response ──────────────────────────────────────────
        result = {
            'alumno': alumno_data,
            'talleres_activos': talleres_activos,
            'matricula_activa': matricula_activa_data,
            'matriculas_historicas': matriculas_historicas_data,
            'estadisticas': estadisticas,
            'estadisticas_por_taller': estadisticas_por_taller,
        }

        return Response(result)
