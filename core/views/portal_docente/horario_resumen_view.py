from datetime import date, datetime

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Asistencia, Horario, MatriculaHorario
from core.serializers.portal_docente.serializers import HorarioResumenFechaSerializer
from core.shared.authentication import ProfesorJWTAuthentication


def _build_registro_from_asistencia(asistencia):
    matricula = asistencia.matricula
    alumno = matricula.alumno
    return {
        'alumno_id': alumno.id,
        'nombre': alumno.nombre,
        'apellido': alumno.apellido,
        'dni': alumno.dni,
        'estado_asistencia': asistencia.estado,
        'es_recuperacion': asistencia.es_recuperacion,
        'hora_asistencia': asistencia.hora,
        'inscripcion_activa': matricula.activo and not matricula.concluida,
    }


def _build_registro_from_matricula_horario(matricula_horario):
    matricula = matricula_horario.matricula
    alumno = matricula.alumno
    return {
        'alumno_id': alumno.id,
        'nombre': alumno.nombre,
        'apellido': alumno.apellido,
        'dni': alumno.dni,
        'estado_asistencia': None,
        'es_recuperacion': False,
        'hora_asistencia': None,
        'inscripcion_activa': matricula.activo and not matricula.concluida,
    }


def _sort_registros(registros):
    return sorted(registros, key=lambda r: (r['apellido'].lower(), r['nombre'].lower()))


class ProfesorHorarioResumenFechaView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/horarios/{horario_id}/resumen-fecha/?fecha=YYYY-MM-DD

    Returns a date-aware unified view of a schedule for a specific date.
    Mode is determined server-side by comparing fecha against date.today().

    - pasado: attendance records for that date
    - hoy: attendance records if they exist, otherwise enrolled students
    - futuro: enrolled students with a disclaimer
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id, horario_id):
        fecha_str = request.query_params.get('fecha')
        if not fecha_str:
            return Response(
                {"detail": "Parameter 'fecha' is required (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            return Response(
                {"detail": "Fecha inválida. Use formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify ownership and retrieve the schedule in a single query.
        # A professor may have multiple Profesor records (one per cycle), so
        # we match by DNI rather than the JWT profesor_id.
        try:
            horario = Horario.objects.select_related('taller').get(
                id=horario_id,
                ciclo_id=ciclo_id,
                profesor__dni=request.user.dni,
                profesor__activo=True,
                ciclo__activo=True,
                activo=True,
            )
        except Horario.DoesNotExist:
            return Response(
                {"detail": "Horario no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

        today = date.today()
        if fecha < today:
            modo = 'pasado'
        elif fecha == today:
            modo = 'hoy'
        else:
            modo = 'futuro'

        registros = []
        aviso = None

        if modo == 'pasado':
            asistencias = list(Asistencia.objects.filter(
                horario=horario,
                fecha=fecha,
                matricula__activo=True,
                matricula__fecha_matricula__date__lte=fecha,
            ).select_related('matricula__alumno'))
            registros = [_build_registro_from_asistencia(a) for a in asistencias]

        elif modo == 'hoy':
            # Base: all enrolled students (active + enrolled before this date)
            matricula_horarios = list(MatriculaHorario.objects.filter(
                horario=horario,
                matricula__activo=True,
                matricula__concluida=False,
                matricula__fecha_matricula__date__lte=fecha,
            ).select_related('matricula__alumno'))

            enrolled_map = {
                mh.matricula.alumno_id: _build_registro_from_matricula_horario(mh)
                for mh in matricula_horarios
            }

            # Overlay: attendance records (overrides enrolled entries)
            asistencias = list(Asistencia.objects.filter(
                horario=horario,
                fecha=fecha,
                matricula__activo=True,
                matricula__fecha_matricula__date__lte=fecha,
            ).select_related('matricula__alumno'))

            for a in asistencias:
                enrolled_map[a.matricula.alumno_id] = _build_registro_from_asistencia(a)

            registros = list(enrolled_map.values())

        else:  # futuro
            aviso = "Inscripción sujeta a cambios"
            matricula_horarios = list(MatriculaHorario.objects.filter(
                horario=horario,
                matricula__activo=True,
                matricula__concluida=False,
                matricula__fecha_matricula__date__lte=fecha,
            ).select_related('matricula__alumno'))
            registros = [_build_registro_from_matricula_horario(mh) for mh in matricula_horarios]

        data = {
            'modo': modo,
            'fecha': fecha,
            'aviso': aviso,
            'horario_id': horario.id,
            'taller_nombre': horario.taller.nombre,
            'hora_inicio': horario.hora_inicio,
            'hora_fin': horario.hora_fin,
            'registros': _sort_registros(registros),
        }

        return Response(HorarioResumenFechaSerializer(data).data)
