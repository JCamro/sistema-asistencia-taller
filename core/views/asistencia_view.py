from datetime import date

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Asistencia, Matricula, MatriculaHorario, Horario, Feriado
from ..serializers import AsistenciaSerializer, AsistenciaListSerializer
from .pagination import StandardResultsSetPagination


class AsistenciaViewSet(viewsets.ModelViewSet):
    queryset = Asistencia.objects.select_related(
        'matricula__alumno',
        'matricula__taller',
        'horario__taller',
        'profesor'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['matricula', 'horario', 'profesor', 'estado', 'fecha']
    search_fields = ['matricula__alumno__nombre', 'matricula__alumno__apellido']
    ordering_fields = ['fecha', 'hora']
    ordering = ['-fecha', '-hora']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return AsistenciaListSerializer
        return AsistenciaSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(
                Q(matricula__ciclo_id=ciclo_id) | 
                Q(horario__ciclo_id=ciclo_id)
            )
        return queryset

    @action(detail=False, methods=['get'], url_path='por-horario')
    def por_horario(self, request, ciclo_id=None):
        horario_id = request.query_params.get('horario_id')
        fecha = request.query_params.get('fecha')
        
        if not ciclo_id or not horario_id or not fecha:
            return Response({'error': 'Faltan parámetros: ciclo_id, horario_id, fecha'}, status=400)
        
        try:
            fecha_obj = date.fromisoformat(fecha)
        except (ValueError, TypeError):
            return Response({'error': 'Fecha inválida. Use formato YYYY-MM-DD.'}, status=400)
        
        try:
            horario = Horario.objects.get(id=horario_id)
        except Horario.DoesNotExist:
            return Response({'error': 'Horario no encontrado'}, status=404)
        
        if str(horario.ciclo_id) != str(ciclo_id):
            return Response({'error': 'El horario no pertenece a este ciclo'}, status=400)

        feriado = Feriado.objects.filter(
            Q(ciclo_id=ciclo_id, fecha=fecha_obj, taller__isnull=True, horario__isnull=True) |
            Q(ciclo_id=ciclo_id, fecha=fecha_obj, taller=horario.taller, horario__isnull=True) |
            Q(ciclo_id=ciclo_id, fecha=fecha_obj, taller=horario.taller, horario=horario)
        ).first()
        es_feriado = feriado is not None
        motivo_feriado = feriado.motivo if feriado else None

        matriculas_horario = MatriculaHorario.objects.filter(
            horario_id=horario_id,
            matricula__activo=True,
            matricula__concluida=False,
            matricula__fecha_matricula__isnull=False,
            matricula__fecha_matricula__date__lte=fecha_obj,
        ).select_related('matricula__alumno', 'matricula__taller')

        # ponytail: bulk fetch asistencias instead of N individual queries
        asistencias_dict = {
            a.matricula_id: a
            for a in Asistencia.objects.filter(
                horario_id=horario_id,
                fecha=fecha,
                es_recuperacion=False,
            ).select_related('profesor')
        }

        resultados = []
        alumnos_regulares_ids = set()

        for mh in matriculas_horario:
            asistencia = asistencias_dict.get(mh.matricula.id)

            alumnos_regulares_ids.add(mh.matricula.alumno.id)

            resultados.append({
                'matricula_id': mh.matricula.id,
                'alumno_id': mh.matricula.alumno.id,
                'alumno_nombre': f"{mh.matricula.alumno.apellido}, {mh.matricula.alumno.nombre}",
                'sesiones_disponibles': mh.matricula.sesiones_disponibles,
                'asistencia_id': asistencia.id if asistencia else None,
                'estado': asistencia.estado if asistencia else None,
                'observacion': asistencia.observacion if asistencia else '',
                'profesor_id': asistencia.profesor_id if asistencia else None,
                'profesor_nombre': f"{asistencia.profesor.apellido}, {asistencia.profesor.nombre}" if (asistencia and asistencia.profesor) else '',
                'es_recuperacion': False,
                'hora': asistencia.hora.strftime('%H:%M') if asistencia else None,
            })
        
        # Incluir attendances de recuperación que no estén en matrículas regulares
        for asist in Asistencia.objects.filter(
            horario_id=horario_id,
            fecha=fecha,
            es_recuperacion=True
        ).select_related('matricula__alumno'):
            if asist.matricula and asist.matricula.alumno.id not in alumnos_regulares_ids:
                resultados.append({
                    'matricula_id': asist.matricula.id,
                    'alumno_id': asist.matricula.alumno.id,
                    'alumno_nombre': f"{asist.matricula.alumno.apellido}, {asist.matricula.alumno.nombre}",
                    'sesiones_disponibles': asist.matricula.sesiones_disponibles,
                    'asistencia_id': asist.id,
                    'estado': asist.estado,
                'observacion': asist.observacion,
                'profesor_id': asist.profesor_id,
                'profesor_nombre': f"{asist.profesor.apellido}, {asist.profesor.nombre}" if asist.profesor else '',
                'es_recuperacion': True,
                'hora': asist.hora.strftime('%H:%M'),
            })

        return Response({
            'es_feriado': es_feriado,
            'motivo': motivo_feriado,
            'resultados': resultados,
        })

    @action(detail=False, methods=['get'], url_path='por-dia')
    def por_dia(self, request, ciclo_id=None):
        if not ciclo_id:
            return Response({'error': 'Se requiere ciclo_id'}, status=status.HTTP_400_BAD_REQUEST)

        fecha_str = request.query_params.get('fecha', '').strip()
        if not fecha_str:
            return Response({'error': 'Se requiere fecha (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            fecha = date.fromisoformat(fecha_str)
        except (ValueError, TypeError):
            return Response({'error': 'Formato de fecha inválido. Usar YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        dia_semana = fecha.weekday()

        horarios = Horario.objects.filter(
            ciclo_id=ciclo_id,
            dia_semana=dia_semana,
            activo=True
        ).select_related('taller', 'profesor')

        horario_ids = [h.id for h in horarios]

        feriados = list(Feriado.objects.filter(ciclo_id=ciclo_id, fecha=fecha))
        feriado_global = next((f for f in feriados if f.taller_id is None and f.horario_id is None), None)

        mh_por_horario = {}
        for mh in MatriculaHorario.objects.filter(
            horario_id__in=horario_ids,
            matricula__activo=True,
            matricula__concluida=False,
            matricula__fecha_matricula__isnull=False,
            matricula__fecha_matricula__date__lte=fecha,
        ).select_related('matricula__alumno'):
            mh_por_horario.setdefault(mh.horario_id, []).append(mh)

        asis_por_matricula = {}
        for a in Asistencia.objects.filter(
            horario_id__in=horario_ids,
            fecha=fecha
        ).select_related('matricula'):
            if a.matricula_id:
                asis_por_matricula[a.matricula_id] = a

        asis_recuperacion_por_horario = {}
        for a in Asistencia.objects.filter(
            horario_id__in=horario_ids,
            fecha=fecha,
            es_recuperacion=True
        ).select_related('matricula__alumno'):
            if a.matricula_id:
                asis_recuperacion_por_horario.setdefault(a.horario_id, {})[a.matricula_id] = a

        resultado = []
        for h in horarios:
            feriado_horario = next(
                (f for f in feriados if f.horario_id == h.id or (f.taller_id == h.taller_id and f.horario_id is None)),
                None
            )
            es_feriado = feriado_global is not None or feriado_horario is not None

            alumnos_data = []
            for mh in mh_por_horario.get(h.id, []):
                asis = asis_por_matricula.get(mh.matricula_id)
                alumnos_data.append({
                    'matricula_id': mh.matricula_id,
                    'alumno_id': mh.matricula.alumno.id,
                    'alumno_nombre': f"{mh.matricula.alumno.apellido}, {mh.matricula.alumno.nombre}",
                    'sesiones_disponibles': mh.matricula.sesiones_disponibles,
                    'asistencia_id': asis.id if asis else None,
                    'estado': asis.estado if asis else None,
                    'observacion': asis.observacion if asis else '',
                })

            alumnos_regulares_matricula_ids = {mh.matricula_id for mh in mh_por_horario.get(h.id, [])}
            for a_matricula_id, a in asis_recuperacion_por_horario.get(h.id, {}).items():
                if a_matricula_id not in alumnos_regulares_matricula_ids:
                    alumnos_data.append({
                        'matricula_id': a.matricula_id,
                        'alumno_id': a.matricula.alumno.id,
                        'alumno_nombre': f"{a.matricula.alumno.apellido}, {a.matricula.alumno.nombre}",
                        'sesiones_disponibles': a.matricula.sesiones_disponibles,
                        'asistencia_id': a.id,
                        'estado': a.estado,
                        'observacion': a.observacion or '',
                    })

            resultado.append({
                'horario_id': h.id,
                'taller_id': h.taller.id,
                'taller_nombre': h.taller.nombre,
                'hora_inicio': str(h.hora_inicio),
                'hora_fin': str(h.hora_fin),
                'profesor_id': h.profesor.id if h.profesor else None,
                'profesor_nombre': f"{h.profesor.apellido}, {h.profesor.nombre}" if h.profesor else None,
                'es_feriado': es_feriado,
                'alumnos': alumnos_data,
            })

        return Response({
            'fecha': fecha_str,
            'dia_semana': dia_semana,
            'es_feriado': feriado_global is not None,
            'motivo': feriado_global.motivo if feriado_global else None,
            'horarios': resultado,
        })

    @action(detail=False, methods=['get'], url_path='recuperables')
    def recuperables(self, request, ciclo_id=None):
        """
        GET /api/ciclos/:ciclo_id/asistencias/recuperables/?horario_id=X

        Retorna alumnos que pueden ser agregados como recuperación en un horario.
        Un alumno es elegible si:
        1. Tiene matrícula activa y no concluida en el ciclo
        2. NO está registrado regularmente en ese horario (MatriculaHorario)
        3. NO tiene ya una asistencia (regular o recuperación) para ese horario/fecha
        """
        horario_id = request.query_params.get('horario_id')
        fecha = request.query_params.get('fecha')

        if not ciclo_id or not horario_id:
            return Response({'error': 'Faltan parámetros: ciclo_id, horario_id'}, status=400)

        try:
            horario = Horario.objects.get(id=horario_id)
        except Horario.DoesNotExist:
            return Response({'error': 'Horario no encontrado'}, status=404)

        if str(horario.ciclo_id) != str(ciclo_id):
            return Response({'error': 'El horario no pertenece a este ciclo'}, status=400)

        # Alumnos ya registrados regularmente en este horario
        # Si se proporciona fecha, solo excluir regulares inscritos en o antes de esa fecha.
        # Los inscritos después son elegibles para recuperación (no existían en esa fecha).
        if fecha:
            try:
                fecha_obj = date.fromisoformat(fecha)
            except (ValueError, TypeError):
                return Response({'error': 'Fecha inválida. Use formato YYYY-MM-DD.'}, status=400)
            matriculas_horario = MatriculaHorario.objects.filter(
                horario_id=horario_id,
                matricula__fecha_matricula__isnull=False,
                matricula__fecha_matricula__date__lte=fecha_obj,
            ).select_related('matricula__alumno', 'matricula__taller')
        else:
            matriculas_horario = MatriculaHorario.objects.filter(
                horario_id=horario_id
            ).select_related('matricula__alumno', 'matricula__taller')

        alumnos_regulares_ids = set(mh.matricula.alumno_id for mh in matriculas_horario)

        # Alumnos que ya tienen asistencia (regular o recuperación) para este horario/fecha
        if fecha:
            existentes = Asistencia.objects.filter(
                horario_id=horario_id,
                fecha=fecha
            ).select_related('matricula__alumno')
            for a in existentes:
                if a.matricula:
                    alumnos_regulares_ids.add(a.matricula.alumno_id)

        # Alumnos con matrícula activa/no concluida en el ciclo, excluidos los ya en el horario
        matriculas = Matricula.objects.filter(
            ciclo_id=ciclo_id,
            activo=True,
            concluida=False
        ).exclude(
            alumno_id__in=alumnos_regulares_ids
        ).select_related('alumno', 'taller')

        resultados = []
        for m in matriculas:
            resultados.append({
                'matricula_id': m.id,
                'alumno_id': m.alumno.id,
                'alumno_nombre': f"{m.alumno.apellido}, {m.alumno.nombre}",
                'sesiones_disponibles': m.sesiones_disponibles,
                'taller_nombre': m.taller.nombre,
            })

        return Response(resultados)

    def create(self, request, *args, **kwargs):
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            data = request.data.copy()
            if 'profesor' not in data:
                return Response({'error': 'Profesor es requerido'}, status=400)
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        return super().create(request, *args, **kwargs)
