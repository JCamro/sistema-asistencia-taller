from django.db import transaction
from django.db.models import Case, When, Value, CharField, Exists, OuterRef, Count
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import Matricula, MatriculaHorario, Asistencia, HistorialTraspaso, Taller, PrecioPaquete, ReciboMatricula
from ..serializers import MatriculaSerializer, MatriculaListSerializer, TraspasoSerializer
from ..shared.serializer_helpers import get_estado_matricula, get_recibo_estado
from .pagination import StandardResultsSetPagination


class MatriculaViewSet(viewsets.ModelViewSet):
    queryset = Matricula.objects.select_related('alumno', 'ciclo', 'taller').prefetch_related('horarios').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ciclo', 'taller', 'activo', 'concluida']
    search_fields = ['alumno__nombre', 'alumno__apellido', 'alumno__dni']
    ordering_fields = ['fecha_matricula', 'alumno__apellido']
    ordering = ['-fecha_matricula']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return MatriculaListSerializer
        return MatriculaSerializer

    def get_queryset(self):
        from django.db.models import Exists, OuterRef, Count, Q, IntegerField, F, Value as V
        from django.db.models.functions import Coalesce
        
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(ciclo_id=ciclo_id)
        
        # Annotate estado_calculado to avoid N+1 queries
        # Note: Exists subquery must be defined inside annotate to maintain OuterRef context
        queryset = queryset.annotate(
            estado_calculado=Case(
                When(activo=False, then=Value('inactiva')),
                When(concluida=True, then=Value('concluida')),
                When(Exists(ReciboMatricula.objects.filter(
                    matricula=OuterRef('pk'),
                    recibo__estado__in=['pagado', 'pendiente']
                )), then=Value('activa')),
                default=Value('no_procesado'),
                output_field=CharField()
            )
        )
        
        # Annotate sesiones_consumidas for por_concluir filter
        queryset = queryset.annotate(
            _sesiones_consumidas=Coalesce(
                Count('asistencias', filter=Q(asistencias__estado='asistio')),
                V(0, output_field=IntegerField())
            ),
            _sesiones_disponibles=F('sesiones_contratadas') - F('_sesiones_consumidas')
        )
        
        # Filter by estado query param
        estado = self.request.query_params.get('estado', '').strip()
        if estado and estado != 'todas':
            if estado == 'por_concluir':
                queryset = queryset.filter(
                    estado_calculado='activa',
                    _sesiones_disponibles__lte=3
                )
            else:
                queryset = queryset.filter(estado_calculado=estado)
        
        # Filter by dia_semana (day of week) via MatriculaHorario junction
        dia = self.request.query_params.get('dia', '').strip()
        if dia:
            try:
                dia_int = int(dia)
                if 0 <= dia_int <= 6:
                    queryset = queryset.filter(
                        Exists(MatriculaHorario.objects.filter(
                            matricula=OuterRef('pk'),
                            horario__dia_semana=dia_int
                        ))
                    )
            except (ValueError, TypeError):
                pass  # Invalid dia value, ignore filter
        
        # Filter by hora_inicio (hour) via MatriculaHorario junction
        hora = self.request.query_params.get('hora', '').strip()
        if hora:
            try:
                hora_int = int(hora)
                if 8 <= hora_int <= 21:
                    queryset = queryset.filter(
                        Exists(MatriculaHorario.objects.filter(
                            matricula=OuterRef('pk'),
                            horario__hora_inicio__hour=hora_int
                        ))
                    )
            except (ValueError, TypeError):
                pass  # Invalid hora value, ignore filter
        
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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        from ..models import ReciboMatricula
        vinculos = ReciboMatricula.objects.filter(matricula=instance).select_related('recibo')
        activos = [v for v in vinculos if v.recibo.estado != 'anulado']
        if activos:
            return Response(
                {'detail': 'No se puede eliminar esta matrícula porque tiene recibos activos asociados. Eliminá o anulá primero los recibos vinculados.'},
                status=status.HTTP_409_CONFLICT
            )
        # All linked recibos are anulado — delete links then matricula
        with transaction.atomic():
            vinculos.delete()
            self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='traspasar')
    def traspasar(self, request, pk=None):
        matricula_origen = self.get_object()

        if not matricula_origen.activo:
            return Response(
                {'detail': 'La matrícula origen no está activa.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TraspasoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alumno_destino_id = serializer.validated_data['alumno_destino_id']

        from ..models import Alumno
        try:
            alumno_destino = Alumno.objects.get(id=alumno_destino_id, activo=True)
        except Alumno.DoesNotExist:
            return Response(
                {'detail': 'El alumno destino no existe o no está activo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if alumno_destino.ciclo_id != matricula_origen.ciclo_id:
            return Response(
                {'detail': 'El alumno destino no pertenece al mismo ciclo.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if alumno_destino_id == matricula_origen.alumno_id:
            return Response(
                {'detail': 'El alumno destino es el mismo que el origen.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        existe = Matricula.objects.filter(
            alumno_id=alumno_destino_id,
            ciclo_id=matricula_origen.ciclo_id,
            taller_id=matricula_origen.taller_id,
            activo=True
        ).exists()

        if existe:
            return Response(
                {'detail': 'El alumno destino ya tiene una matrícula activa en este taller.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                matricula_origen.activo = False
                from django.utils import timezone
                fecha = timezone.now().strftime('%d/%m/%Y %H:%M')
                nombre_destino = f"{alumno_destino.apellido}, {alumno_destino.nombre}"
                nota = f"\n[Traspasado a {nombre_destino} el {fecha}]"
                matricula_origen.observaciones = (matricula_origen.observaciones or '') + nota
                matricula_origen.save()

                matricula_destino = Matricula.objects.create(
                    alumno=alumno_destino,
                    ciclo_id=matricula_origen.ciclo_id,
                    taller_id=matricula_origen.taller_id,
                    sesiones_contratadas=matricula_origen.sesiones_contratadas,
                    precio_total=matricula_origen.precio_total,
                    activo=True,
                    concluida=False,
                )

                horarios = MatriculaHorario.objects.filter(matricula=matricula_origen)
                for h in horarios:
                    MatriculaHorario.objects.get_or_create(
                        matricula=matricula_destino,
                        horario_id=h.horario_id
                    )

                asistencias_count = Asistencia.objects.filter(
                    matricula=matricula_origen
                ).update(matricula=matricula_destino)

                HistorialTraspaso.objects.create(
                    matricula_origen=matricula_origen,
                    matricula_destino=matricula_destino,
                    alumno_origen_id=matricula_origen.alumno_id,
                    alumno_destino=alumno_destino,
                    ciclo_id=matricula_origen.ciclo_id,
                    taller_id=matricula_origen.taller_id,
                    asistencias_transferidas=asistencias_count,
                )

            from ..serializers import MatriculaSerializer
            return Response({
                'detail': 'Traspaso realizado exitosamente.',
                'matricula_origen': MatriculaSerializer(matricula_origen).data,
                'matricula_destino': MatriculaSerializer(matricula_destino).data,
                'asistencias_transferidas': asistencias_count,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'detail': f'Error al realizar el traspaso: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='calcular-precio')
    def calcular_precio(self, request):
        taller_id = request.query_params.get('taller_id')
        sesiones = request.query_params.get('sesiones')

        if not taller_id or not sesiones:
            return Response(
                {'detail': 'Se requiere taller_id y sesiones.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            taller = Taller.objects.get(id=taller_id)
            sesiones = int(sesiones)
        except (Taller.DoesNotExist, ValueError):
            return Response(
                {'detail': 'Taller no encontrado o sesiones inválidas.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        precio = PrecioPaquete.get_precio_individual(taller.tipo, sesiones, ciclo_id=taller.ciclo_id)

        if precio:
            return Response({
                'precio_total': precio['precio_total'],
                'precio_por_sesion': precio['precio_por_sesion'],
                'tipo_taller': taller.tipo,
                'cantidad_clases': sesiones,
                'origen': 'paquete'
            })
        
        # Fallback: si no hay precio configurado, no devolvemos nada
        # El usuario debe configurar precios en Configuración de Precios
        return Response({
            'precio_total': None,
            'precio_por_sesion': None,
            'tipo_taller': taller.tipo,
            'cantidad_clases': sesiones,
            'origen': 'no_configurado',
            'detail': 'No hay precio configurado para este tipo de taller y cantidad de clases.'
        })

    @action(detail=False, methods=['get'], url_path='agrupadas')
    def agrupadas(self, request, ciclo_id=None):
        if not ciclo_id:
            return Response({'error': 'Se requiere ciclo_id'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.filter_queryset(self.get_queryset())
        alumno_ids = queryset.order_by().values_list('alumno_id', flat=True).distinct()

        page = self.paginate_queryset(alumno_ids)
        if page is not None:
            alumno_ids = page

        matriculas = queryset.filter(alumno_id__in=alumno_ids).select_related('alumno', 'taller').prefetch_related('horarios')

        matriculas_por_alumno = {}
        for m in matriculas:
            matriculas_por_alumno.setdefault(m.alumno_id, []).append(m)

        resultado = []
        for alumno_id in alumno_ids:
            matriculas_list = matriculas_por_alumno.get(alumno_id, [])
            if not matriculas_list:
                continue
            alumno = matriculas_list[0].alumno

            matriculas_data = []
            activas = 0
            concluidas = 0
            sin_procesar = 0
            inactivas = 0

            for m in matriculas_list:
                estado = get_estado_matricula(m)
                recibo_estado = get_recibo_estado(m)

                if estado == 'activa':
                    activas += 1
                elif estado == 'concluida':
                    concluidas += 1
                elif estado == 'no_procesado':
                    sin_procesar += 1
                else:
                    inactivas += 1

                matriculas_data.append({
                    'id': m.id,
                    'taller': m.taller.nombre,
                    'taller_id': m.taller.id,
                    'taller_tipo': m.taller.tipo,
                    'sesiones_consumidas': m.sesiones_consumidas,
                    'sesiones_contratadas': m.sesiones_contratadas,
                    'precio_total': str(m.precio_total),
                    'estado': estado,
                    'recibo_estado': recibo_estado,
                    'fecha_matricula': m.fecha_matricula.isoformat() if m.fecha_matricula else None,
                })

            resultado.append({
                'alumno_id': alumno.id,
                'alumno_nombre': f"{alumno.apellido}, {alumno.nombre}",
                'alumno_dni': alumno.dni,
                'matriculas': matriculas_data,
                'activas': activas,
                'concluidas': concluidas,
                'sin_procesar': sin_procesar,
                'inactivas': inactivas,
            })

        return self.get_paginated_response(resultado)

    @action(detail=True, methods=['get'], url_path='detalle')
    def detalle(self, request, pk=None, ciclo_id=None):
        if not ciclo_id:
            return Response({'error': 'Se requiere ciclo_id'}, status=status.HTTP_400_BAD_REQUEST)

        matricula = self.get_object()
        recibo_matricula = matricula.recibos.select_related('recibo').first()
        recibo = recibo_matricula.recibo if recibo_matricula else None

        horarios = matricula.horarios.select_related('horario__profesor').all()
        horarios_data = [{
            'id': mh.horario.id,
            'dia': mh.horario.get_dia_semana_display(),
            'dia_numero': mh.horario.dia_semana,
            'hora_inicio': str(mh.horario.hora_inicio),
            'hora_fin': str(mh.horario.hora_fin),
            'profesor_nombre': f"{mh.horario.profesor.apellido}, {mh.horario.profesor.nombre}" if mh.horario.profesor else '',
        } for mh in horarios]

        asistencias = matricula.asistencias.select_related('horario', 'profesor').all()
        asistencias_data = [{
            'id': a.id,
            'fecha': str(a.fecha),
            'estado': a.estado,
            'es_recuperacion': a.es_recuperacion,
            'horario': str(a.horario),
            'profesor_nombre': f"{a.profesor.apellido}, {a.profesor.nombre}" if a.profesor else '',
            'hora': str(a.hora) if a.hora else '',
            'observacion': a.observacion or '',
        } for a in asistencias]

        return Response({
            'matricula': {
                'id': matricula.id,
                'alumno_id': matricula.alumno.id,
                'alumno_nombre': f"{matricula.alumno.apellido}, {matricula.alumno.nombre}",
                'taller': matricula.taller.nombre,
                'taller_id': matricula.taller.id,
                'sesiones_contratadas': matricula.sesiones_contratadas,
                'sesiones_consumidas': matricula.sesiones_consumidas,
                'sesiones_disponibles': matricula.sesiones_disponibles,
                'precio_total': str(matricula.precio_total),
                'precio_por_sesion': str(matricula.precio_por_sesion),
                'estado': get_estado_matricula(matricula),
                'recibo_estado': get_recibo_estado(matricula),
                'recibo': {
                    'id': recibo.id,
                    'numero': recibo.numero,
                    'estado': recibo.estado,
                    'monto_total': str(recibo.monto_total),
                    'monto_pagado': str(recibo.monto_pagado),
                } if recibo else None,
                'horarios': horarios_data,
                'asistencias': asistencias_data,
                'fecha_matricula': matricula.fecha_matricula.isoformat() if matricula.fecha_matricula else None,
            }
        })
