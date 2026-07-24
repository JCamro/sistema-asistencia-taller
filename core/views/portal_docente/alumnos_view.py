from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import Q, Prefetch, Exists, OuterRef, Subquery, Max

from core.models import Alumno, MatriculaHorario, Matricula, Asistencia
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo
from core.views.pagination import StandardResultsSetPagination


class ProfesorAlumnosCartillaView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/alumnos/

    Returns deduplicated students enrolled in the authenticated professor's
    horarios for the given cycle. Each student appears once with a nested
    horarios list (taller badges).

    Includes both active and historical students, paginated, and annotated
    with estado (activo/historico) and fecha_ultima_asistencia.

    Query params:
        ?estado=activo|historico|todos  — filter by enrollment status (default: todos)
        ?search=X     — filters by nombre, apellido (icontains) or DNI (icontains)
        ?taller_id=X  — filters by taller id (only students in that taller)
        ?dia_semana=0..6  — filters by day of week
        ?hora=8..21       — filters by hour_inicio hour
        ?page=N           — page number for pagination (default: 1)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
        profesor_id = request.user.id
        search = request.query_params.get('search', '').strip()
        taller_id = request.query_params.get('taller_id')
        estado_filter = request.query_params.get('estado', 'todos')
        dia_semana = request.query_params.get('dia_semana')
        hora = request.query_params.get('hora')

        # ── Base queryset: all students linked to profesor's horarios ──
        qs = Alumno.objects.filter(
            matriculas__horarios__horario__profesor_id=profesor_id,
            matriculas__horarios__horario__ciclo_id=ciclo_id,
            matriculas__horarios__horario__activo=True,
        ).distinct()

        # ── Annotations ────────────────────────────────────────────────
        # Exists subquery: alumno has at least one active, non-concluded matricula
        active_matricula_qs = Matricula.objects.filter(
            alumno=OuterRef('pk'),
            activo=True,
            concluida=False,
            horarios__horario__profesor_id=profesor_id,
            horarios__horario__ciclo_id=ciclo_id,
            horarios__horario__activo=True,
        )
        active_exists = Exists(active_matricula_qs)

        # Subquery: latest date the student actually attended (estado='asistio' only)
        ultima_asistencia_qs = Asistencia.objects.filter(
            matricula__alumno=OuterRef('pk'),
            matricula__horarios__horario__profesor_id=profesor_id,
            matricula__horarios__horario__ciclo_id=ciclo_id,
            estado='asistio',
        ).values('matricula__alumno').annotate(
            max_fecha=Max('fecha')
        ).values('max_fecha')[:1]

        qs = qs.annotate(
            tiene_matricula_activa=active_exists,
            fecha_ultima_asistencia=Subquery(ultima_asistencia_qs),
        )

        # ── Apply estado filter (before ordering to keep WHERE clean) ──
        if estado_filter == 'activo':
            qs = qs.filter(tiene_matricula_activa=True)
        elif estado_filter == 'historico':
            qs = qs.filter(tiene_matricula_activa=False)

        # ── Apply cascade filters ──────────────────────────────────────
        if search:
            qs = qs.filter(
                Q(nombre__icontains=search) |
                Q(apellido__icontains=search) |
                Q(dni__icontains=search)
            )

        if taller_id:
            qs = qs.filter(
                Exists(MatriculaHorario.objects.filter(
                    matricula__alumno=OuterRef('pk'),
                    horario__taller_id=taller_id,
                    horario__profesor_id=profesor_id,
                    horario__ciclo_id=ciclo_id,
                ))
            )

        if dia_semana is not None:
            try:
                dia = int(dia_semana)
                qs = qs.filter(
                    Exists(MatriculaHorario.objects.filter(
                        matricula__alumno=OuterRef('pk'),
                        horario__dia_semana=dia,
                        horario__profesor_id=profesor_id,
                        horario__ciclo_id=ciclo_id,
                    ))
                )
            except (ValueError, TypeError):
                pass

        if hora is not None:
            try:
                hora_val = int(hora)
                qs = qs.filter(
                    Exists(MatriculaHorario.objects.filter(
                        matricula__alumno=OuterRef('pk'),
                        horario__hora_inicio__hour=hora_val,
                        horario__profesor_id=profesor_id,
                        horario__ciclo_id=ciclo_id,
                    ))
                )
            except (ValueError, TypeError):
                pass

        # ── Ordering: active first, then by apellido/nombre ────────────
        qs = qs.order_by('-tiene_matricula_activa', 'apellido', 'nombre')

        # ── Pagination ─────────────────────────────────────────────────
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)

        if page is not None:
            # Prefetch MatriculaHorario only for paginated alumnos
            page_ids = [a.id for a in page]
            alumnos_prefetched = Alumno.objects.filter(id__in=page_ids).prefetch_related(
                Prefetch(
                    'matriculas__horarios',
                    queryset=MatriculaHorario.objects.filter(
                        horario__profesor_id=profesor_id,
                        horario__ciclo_id=ciclo_id,
                        horario__activo=True,
                    ).select_related('horario__taller'),
                    to_attr='alumno_mh_list',
                )
            )
            alumno_map = {a.id: a for a in alumnos_prefetched}

            # Build response maintaining paginated order
            alumnos_data = []
            for alumno in page:
                prefetched = alumno_map.get(alumno.id, alumno)
                horarios = []
                seen = set()
                for matricula in prefetched.matriculas.all():
                    for mh in getattr(matricula, 'alumno_mh_list', None) or []:
                        h = mh.horario
                        if h.id not in seen:
                            seen.add(h.id)
                            horarios.append({
                                'id': h.id,
                                'taller_id': h.taller_id,
                                'taller_nombre': h.taller.nombre,
                                'taller_tipo': h.taller.tipo,
                                'dia_semana': h.dia_semana,
                                'hora_inicio': h.hora_inicio.strftime('%H:%M:%S'),
                                'hora_fin': h.hora_fin.strftime('%H:%M:%S'),
                            })

                alumnos_data.append({
                    'id': alumno.id,
                    'nombre': alumno.nombre,
                    'apellido': alumno.apellido,
                    'dni': alumno.dni,
                    'telefono': alumno.telefono or '',
                    'email': alumno.email or '',
                    'estado': 'activo' if alumno.tiene_matricula_activa else 'historico',
                    'fecha_ultima_asistencia': alumno.fecha_ultima_asistencia,
                    'horarios': horarios,
                })

            return paginator.get_paginated_response(alumnos_data)

        # Fallback: no pagination (should not happen with StandardResultsSetPagination)
        return Response([])
