from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Asistencia, NotaClase
from core.models.hora_trabajada import HoraTrabajada
from core.serializers.portal_docente.serializers import HoraTrabajadaDetalleSerializer
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorHorasTrabajadasDetalleView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horas-trabajadas/detalle/

    Returns worked hours for the authenticated professor grouped by
    date (descending), workshop name, and time slot.

    Query params:
    - fecha_desde: YYYY-MM-DD (optional)
    - fecha_hasta: YYYY-MM-DD (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        queryset = HoraTrabajada.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
        ).select_related(
            'horario__taller',
        ).order_by(
            '-fecha', 'horario__taller__nombre', 'horario__hora_inicio'
        )

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if fecha_desde:
            queryset = queryset.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha__lte=fecha_hasta)

        horario_ids = set()
        fechas = set()
        for ht in queryset:
            if ht.horario_id:
                horario_ids.add(ht.horario_id)
            fechas.add(ht.fecha)

        alumnos_map = {}
        if horario_ids and fechas:
            asistencias = Asistencia.objects.filter(
                profesor_id=profesor_id,
                horario_id__in=horario_ids,
                fecha__in=fechas,
                estado='asistio',
            ).select_related('matricula__alumno')

            for asistencia in asistencias:
                alumno = asistencia.matricula.alumno if asistencia.matricula else None
                if not alumno:
                    continue
                key = (asistencia.horario_id, asistencia.fecha)
                alumnos_map.setdefault(key, []).append({
                    'nombre_completo': f"{alumno.apellido}, {alumno.nombre}",
                    'estado': asistencia.estado,
                })

        notas_map = {}
        if horario_ids and fechas:
            notas = NotaClase.objects.filter(
                profesor_id=profesor_id,
                horario_id__in=horario_ids,
                fecha__in=fechas,
            )
            for nota in notas:
                notas_map[(nota.horario_id, nota.fecha)] = nota.contenido

        serializer_context = {
            'alumnos_map': alumnos_map,
            'notas_map': notas_map,
        }

        grouped = {}
        for ht in queryset:
            slot = HoraTrabajadaDetalleSerializer(
                ht, context=serializer_context
            ).data
            taller_nombre = slot['taller_nombre'] or 'Sin taller'
            grouped.setdefault(str(ht.fecha), {}).setdefault(
                taller_nombre, []
            ).append(slot)

        return Response(grouped)
