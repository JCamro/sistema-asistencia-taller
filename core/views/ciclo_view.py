from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.hashers import check_password
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from ..models import (
    Ciclo, Asistencia, MatriculaHorario, ReciboMatricula,
    PagoProfesorDetalle, NotaAlumno, NotaClase, HoraTrabajada,
    Feriado, Nota, NotaDia, Matricula, Recibo, PagoProfesor,
    Egreso, PrecioPaquete, HistorialTraspaso, Horario, Taller,
    Profesor, Alumno, Configuracion,
)
from ..serializers import CicloSerializer, CicloListSerializer
from .pagination import StandardResultsSetPagination


class CicloViewSet(viewsets.ModelViewSet):
    queryset = Ciclo.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'activo']
    search_fields = ['nombre']
    ordering_fields = ['nombre', 'fecha_inicio', 'fecha_fin']
    ordering = ['-fecha_inicio']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return CicloListSerializer
        return CicloSerializer

    def destroy(self, request, *args, **kwargs):
        password = request.data.get('password', '')
        if not password or not check_password(password, request.user.password):
            return Response(
                {'detail': 'Contraseña incorrecta.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        ciclo = self.get_object()

        with transaction.atomic():
            # Delete in dependency order: children before parents.
            # 1. Deepest children (FK to multiple ciclo-scoped models)
            Asistencia.objects.filter(horario__ciclo=ciclo).delete()
            MatriculaHorario.objects.filter(matricula__ciclo=ciclo).delete()
            ReciboMatricula.objects.filter(recibo__ciclo=ciclo).delete()
            PagoProfesorDetalle.objects.filter(pago_profesor__ciclo=ciclo).delete()

            # 2. Mixed FK: ciclo + other ciclo models
            NotaAlumno.objects.filter(ciclo=ciclo).delete()
            NotaClase.objects.filter(ciclo=ciclo).delete()
            HoraTrabajada.objects.filter(ciclo=ciclo).delete()
            Feriado.objects.filter(ciclo=ciclo).delete()
            Nota.objects.filter(ciclo=ciclo).delete()
            NotaDia.objects.filter(ciclo=ciclo).delete()

            # 3. Models with FK to ciclo-scoped parents + FK to ciclo
            Matricula.objects.filter(ciclo=ciclo).delete()
            Recibo.objects.filter(ciclo=ciclo).delete()
            PagoProfesor.objects.filter(ciclo=ciclo).delete()
            Egreso.objects.filter(ciclo=ciclo).delete()
            PrecioPaquete.objects.filter(ciclo=ciclo).delete()
            HistorialTraspaso.objects.filter(ciclo=ciclo).delete()

            # 4. Models with FK to ciclo + other ciclo models (not yet deleted)
            Horario.objects.filter(ciclo=ciclo).delete()
            Taller.objects.filter(ciclo=ciclo).delete()
            Profesor.objects.filter(ciclo=ciclo).delete()
            Alumno.objects.filter(ciclo=ciclo).delete()

            # 5. Singleton config
            Configuracion.objects.filter(ciclo=ciclo).delete()

            # 6. The cycle itself
            ciclo.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
