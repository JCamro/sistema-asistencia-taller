import json
from collections import OrderedDict

from django.db.models import Count, Prefetch, Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Horario, MatriculaHorario
from core.serializers.portal_docente.serializers import (
    HorarioConAlumnosSerializer, _get_taller_color,
)
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorHorariosView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horarios/

    Returns professor's schedules with enrolled student counts for a cycle.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        horarios = Horario.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            activo=True
        ).select_related(
            'taller',
            'profesor'
        ).order_by('dia_semana', 'hora_inicio')

        return Response(
            HorarioConAlumnosSerializer(horarios, many=True).data
        )


class ProfesorHorarioDetalleView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horarios/{horario_id}/

    Returns schedule details with enrolled students list.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id, horario_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        try:
            horario = Horario.objects.filter(
                id=horario_id,
                ciclo_id=ciclo_id,
                profesor_id=profesor_id,
                activo=True
            ).select_related(
                'taller',
                'profesor'
            ).get()
        except Horario.DoesNotExist:
            return Response(
                {"detail": "Horario no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            HorarioConAlumnosSerializer(horario).data
        )


class ProfesorHorariosSemanalView(APIView):
    """
    GET /api/portal-docente/ciclos/{id}/horarios/semanal/

    Returns professor's schedules grouped by taller for the weekly grid.
    Each taller group contains its horarios with full student lists,
    occupancy data, and deterministic color.
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        horarios = Horario.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            activo=True
        ).select_related(
            'taller',
            'profesor'
        ).prefetch_related(
            Prefetch(
                'matricula_horarios',
                queryset=MatriculaHorario.objects.select_related(
                    'matricula__alumno'
                ).filter(
                    matricula__activo=True,
                    matricula__concluida=False,
                )
            )
        ).annotate(
            _alumnos_count=Count(
                'matricula_horarios__matricula',
                filter=Q(
                    matricula_horarios__matricula__activo=True,
                    matricula_horarios__matricula__concluida=False,
                ),
                distinct=True,
            )
        ).order_by('taller__nombre', 'dia_semana', 'hora_inicio')

        serializer = HorarioConAlumnosSerializer(horarios, many=True)
        data = serializer.data

        # Group by taller
        talleres_map = OrderedDict()
        for item in data:
            taller_id = item['taller_id']
            if taller_id not in talleres_map:
                talleres_map[taller_id] = OrderedDict([
                    ('taller_id', taller_id),
                    ('taller_nombre', item['taller_nombre']),
                    ('taller_tipo', item['taller_tipo']),
                    ('taller_color', item['taller_color']),
                    ('horarios', []),
                ])
            talleres_map[taller_id]['horarios'].append({
                'id': item['id'],
                'dia_semana': item['dia_semana'],
                'hora_inicio': item['hora_inicio'],
                'hora_fin': item['hora_fin'],
                'alumnos_count': item['alumnos_count'],
                'cupo_maximo': item['cupo_maximo'],
                'cupo_disponible': item['cupo_disponible'],
                'alumnos': item['alumnos'],
            })

        return Response({
            'talleres': list(talleres_map.values()),
        })
