import uuid

from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from ..models import Feriado, Asistencia, Horario, MatriculaHorario
from ..serializers import FeriadoSerializer, FeriadoListSerializer
from .pagination import StandardResultsSetPagination


class FeriadoViewSet(viewsets.ModelViewSet):
    queryset = Feriado.objects.select_related('ciclo', 'taller', 'horario').all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return FeriadoListSerializer
        return FeriadoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(ciclo_id=ciclo_id)
        return queryset

    def create(self, request, *args, **kwargs):
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            data = request.data.copy()
            data['ciclo'] = ciclo_id
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='aplicar')
    def aplicar(self, request, pk=None, ciclo_id=None):
        feriado = self.get_object()
        ciclo = feriado.ciclo

        horarios = Horario.objects.filter(
            ciclo=ciclo,
            dia_semana=feriado.fecha.weekday(),
        )
        if feriado.horario:
            horarios = horarios.filter(id=feriado.horario.id)
        elif feriado.taller:
            horarios = horarios.filter(taller=feriado.taller)

        if not horarios.exists():
            return Response({
                'creadas': 0,
                'fecha': str(feriado.fecha),
                'motivo': feriado.motivo,
            })

        asistencias_existentes = Asistencia.objects.filter(
            horario__in=horarios,
            fecha=feriado.fecha
        ).values_list('matricula_id', 'horario_id')
        existentes_set = set(asistencias_existentes)

        matriculas_horario = MatriculaHorario.objects.filter(
            horario__in=horarios,
            matricula__ciclo=ciclo,
            matricula__activo=True,
            matricula__concluida=False,
            matricula__fecha_matricula__isnull=False,
            matricula__fecha_matricula__date__lte=feriado.fecha,
        ).select_related('matricula', 'horario', 'horario__profesor')

        creadas = 0
        nuevas_asistencias = []
        for mh in matriculas_horario:
            if (mh.matricula.id, mh.horario.id) in existentes_set:
                continue
            nuevas_asistencias.append(Asistencia(
                matricula=mh.matricula,
                horario=mh.horario,
                profesor=mh.horario.profesor,
                fecha=feriado.fecha,
                hora=mh.horario.hora_inicio,
                estado='falta',
                observacion=f'Feriado: {feriado.motivo}',
                es_recuperacion=False,
            ))
            creadas += 1
            existentes_set.add((mh.matricula.id, mh.horario.id))

        if nuevas_asistencias:
            Asistencia.objects.bulk_create(nuevas_asistencias)

        return Response({
            'creadas': creadas,
            'fecha': str(feriado.fecha),
            'motivo': feriado.motivo,
        })

    @action(detail=False, methods=['post'], url_path='grupo/(?P<grupo_id>[0-9a-f-]+)/aplicar')
    def aplicar_grupo(self, request, ciclo_id=None, grupo_id=None):
        try:
            grupo_uuid = uuid.UUID(grupo_id)
        except ValueError:
            return Response({'error': 'ID de grupo inválido'}, status=status.HTTP_400_BAD_REQUEST)

        feriados = Feriado.objects.filter(ciclo_id=ciclo_id, grupo=grupo_uuid).order_by('fecha')
        if not feriados.exists():
            return Response({'error': 'Grupo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        total_creadas = 0
        for feriado in feriados:
            horarios = Horario.objects.filter(
                ciclo=feriado.ciclo,
                dia_semana=feriado.fecha.weekday(),
            )
            if feriado.horario:
                horarios = horarios.filter(id=feriado.horario.id)
            elif feriado.taller:
                horarios = horarios.filter(taller=feriado.taller)

            if not horarios.exists():
                continue

            asistencias_existentes = Asistencia.objects.filter(
                horario__in=horarios,
                fecha=feriado.fecha
            ).values_list('matricula_id', 'horario_id')
            existentes_set = set(asistencias_existentes)

            matriculas_horario = MatriculaHorario.objects.filter(
                horario__in=horarios,
                matricula__ciclo=feriado.ciclo,
                matricula__activo=True,
                matricula__concluida=False,
                matricula__fecha_matricula__isnull=False,
                matricula__fecha_matricula__date__lte=feriado.fecha,
            ).select_related('matricula', 'horario', 'horario__profesor')

            nuevas_asistencias = []
            for mh in matriculas_horario:
                if (mh.matricula.id, mh.horario.id) in existentes_set:
                    continue
                nuevas_asistencias.append(Asistencia(
                    matricula=mh.matricula,
                    horario=mh.horario,
                    profesor=mh.horario.profesor,
                    fecha=feriado.fecha,
                    hora=mh.horario.hora_inicio,
                    estado='falta',
                    observacion=f'Feriado: {feriado.motivo}',
                    es_recuperacion=False,
                ))
                existentes_set.add((mh.matricula.id, mh.horario.id))

            if nuevas_asistencias:
                Asistencia.objects.bulk_create(nuevas_asistencias)
                total_creadas += len(nuevas_asistencias)

        return Response({
            'aplicados': total_creadas,
            'fecha_inicio': str(feriados.first().fecha),
            'fecha_fin': str(feriados.last().fecha),
            'motivo': feriados.first().motivo,
        })

    @action(detail=False, methods=['delete'], url_path='grupo/(?P<grupo_id>[0-9a-f-]+)')
    def delete_grupo(self, request, ciclo_id=None, grupo_id=None):
        try:
            grupo_uuid = uuid.UUID(grupo_id)
        except ValueError:
            return Response({'error': 'ID de grupo inválido'}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = Feriado.objects.filter(ciclo_id=ciclo_id, grupo=grupo_uuid).delete()
        if deleted == 0:
            return Response({'error': 'Grupo no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'eliminados': deleted})
