from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, Exists, OuterRef

from core.models import Asistencia, NotaClase
from core.models.hora_trabajada import HoraTrabajada
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorHorasTrabajadasDetalleView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horas-trabajadas/detalle/

    Returns all hours for horarios assigned to the authenticated professor,
    grouped by date, workshop, and time slot. Hours worked by the professor
    include monto and count toward payment. Hours worked by a substitute
    show the substitute's name, 0 monto, and are marked as "sustituto".

    Query params:
    - fecha_desde: YYYY-MM-DD (optional)
    - fecha_hasta: YYYY-MM-DD (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        # Fetch ALL HoraTrabajada for horarios assigned to this profesor
        # (not just the ones where this profesor is the HoraTrabajada.profesor).
        # This lets us show hours worked by substitutes too.
        ht_filters = {
            'ciclo_id': ciclo_id,
            'horario__profesor_id': profesor_id,
        }
        if fecha_desde:
            ht_filters['fecha__gte'] = fecha_desde
        if fecha_hasta:
            ht_filters['fecha__lte'] = fecha_hasta

        queryset = HoraTrabajada.objects.filter(**ht_filters).select_related(
            'horario__taller', 'horario__profesor', 'profesor',
        ).order_by('-fecha', 'horario__taller__nombre', 'horario__hora_inicio')

        # Excluir HoraTrabajada auto-generadas sin Asistencia que las respalde.
        # Cuando un sustituto trabaja, el signal viejo creaba registros para el titular
        # (horario.profesor). Esos registros no tienen Asistencia.profesor que coincida.
        # Filtramos: para cada (profesor, horario, fecha), debe existir al menos una
        # Asistencia con ese mismo profesor.
        from django.db.models import Exists, OuterRef
        asistencia_valida = Asistencia.objects.filter(
            horario_id=OuterRef('horario_id'),
            fecha=OuterRef('fecha'),
            profesor_id=OuterRef('profesor_id'),
            estado='asistio',
        )
        queryset = queryset.filter(
            Q(created_from='admin_manual') | Exists(asistencia_valida)
        )

        horario_ids = set()
        fechas = set()
        for ht in queryset:
            if ht.horario_id:
                horario_ids.add(ht.horario_id)
            fechas.add(ht.fecha)

        # Fetch Asistencia for all horarios+fechas (students who attended)
        alumnos_map = {}
        if horario_ids and fechas:
            asistencias = Asistencia.objects.filter(
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
                    'nombre_completo': f"{alumno.nombre} {alumno.apellido}",
                    'estado': asistencia.estado,
                })

        # Fetch NotaClase for all horarios+fechas
        notas_map = {}
        if horario_ids and fechas:
            notas = NotaClase.objects.filter(
                horario_id__in=horario_ids,
                fecha__in=fechas,
            )
            for nota in notas:
                notas_map[(nota.horario_id, nota.fecha)] = nota.contenido

        grouped = {}
        for ht in queryset:
            es_sustituto = ht.profesor_id != profesor_id
            taller_nombre = ht.horario.taller.nombre if ht.horario and ht.horario.taller else 'Sin taller'

            alumnos = alumnos_map.get((ht.horario_id, ht.fecha), [])
            nota_clase = notas_map.get((ht.horario_id, ht.fecha))

            slot = {
                'id': ht.id,
                'fecha': str(ht.fecha),
                'horario_id': ht.horario_id,
                'hora_inicio': str(ht.horario.hora_inicio)[:5] if ht.horario else '',
                'hora_fin': str(ht.horario.hora_fin)[:5] if ht.horario else '',
                'taller_nombre': taller_nombre,
                'num_alumnos': len(alumnos),
                'monto_profesor': '0.00' if es_sustituto else str(ht.monto_profesor),
                'observacion': ht.observacion or '',
                'alumnos': alumnos,
                'nota_clase': nota_clase,
                'es_sustituto': es_sustituto,
                'profesor_que_trabajo': f"{ht.profesor.apellido}, {ht.profesor.nombre}" if es_sustituto else '',
                'profesor_titular': f"{ht.horario.profesor.apellido}, {ht.horario.profesor.nombre}" if ht.horario and ht.horario.profesor else '',
            }

            grouped.setdefault(str(ht.fecha), {}).setdefault(
                taller_nombre, []
            ).append(slot)

        return Response(grouped)
