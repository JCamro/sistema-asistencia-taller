from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db.models import Q, Prefetch

from core.models import Alumno, MatriculaHorario
from core.authentication import ProfesorJWTAuthentication


class ProfesorAlumnosCartillaView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/alumnos/

    Returns deduplicated students enrolled in the authenticated professor's
    horarios for the given cycle. Each student appears once with a nested
    horarios list (taller badges).

    Query params:
        ?search=X     — filters by nombre, apellido (icontains) or DNI (icontains)
        ?taller_id=X  — filters by taller id (only students in that taller)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = request.user.id
        search = request.query_params.get('search', '').strip()
        taller_id = request.query_params.get('taller_id')

        # Base queryset: active, non-concluded matriculas in active horarios
        qs = Alumno.objects.filter(
            matriculas__horarios__horario__profesor_id=profesor_id,
            matriculas__horarios__horario__ciclo_id=ciclo_id,
            matriculas__activo=True,
            matriculas__concluida=False,
            matriculas__horarios__horario__activo=True,
        ).distinct()

        # Prefetch MatriculaHorario instances with nested Horario+Taller
        qs = qs.prefetch_related(
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

        # Apply search filter (nombre, apellido, DNI)
        if search:
            qs = qs.filter(
                Q(nombre__icontains=search) |
                Q(apellido__icontains=search) |
                Q(dni__icontains=search)
            )

        # Apply taller_id filter
        if taller_id:
            qs = qs.filter(matriculas__horarios__horario__taller_id=taller_id)

        # Build response: deduplicated students with nested horarios
        alumnos_data = []
        for alumno in qs:
            horarios = []
            seen = set()
            for matricula in alumno.matriculas.all():
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
                'horarios': horarios,
            })

        return Response(alumnos_data)
