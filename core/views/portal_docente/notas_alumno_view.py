from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import NotaAlumno, Horario, Ciclo
from core.serializers.portal_docente.serializers import NotaAlumnoSerializer
from core.authentication import ProfesorJWTAuthentication


class ProfesorNotasAlumnoView(APIView):
    """
    GET/POST /api/portal-docente/ciclos/{id}/notas-alumno/

    GET: Returns notas filterable by horario_id, fecha, and alumno_id.
    POST: Creates a new NotaAlumno for a specific student in a class session.

    Query params for GET:
    - horario_id: filter by schedule (optional)
    - fecha: YYYY-MM-DD (optional)
    - alumno_id: filter by student (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = request.user.id

        queryset = NotaAlumno.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
        ).select_related('alumno').order_by('-fecha', '-created_at')

        # Filter by horario
        horario_id = request.query_params.get('horario_id')
        if horario_id:
            queryset = queryset.filter(horario_id=horario_id)

        # Filter by fecha
        fecha = request.query_params.get('fecha')
        if fecha:
            queryset = queryset.filter(fecha=fecha)

        # Filter by alumno
        alumno_id = request.query_params.get('alumno_id')
        if alumno_id:
            queryset = queryset.filter(alumno_id=alumno_id)

        return Response(
            NotaAlumnoSerializer(queryset, many=True).data
        )

    def post(self, request, ciclo_id):
        profesor_id = request.user.id

        # Validate ciclo exists
        try:
            Ciclo.objects.get(id=ciclo_id)
        except Ciclo.DoesNotExist:
            return Response(
                {"detail": "Ciclo no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = NotaAlumnoSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        horario_id = serializer.validated_data['horario'].id
        alumno_id = serializer.validated_data['alumno'].id

        # Validate horario belongs to this profesor and ciclo
        try:
            horario = Horario.objects.get(
                id=horario_id,
                ciclo_id=ciclo_id,
                profesor_id=profesor_id,
                activo=True
            )
        except Horario.DoesNotExist:
            return Response(
                {"detail": "Horario no encontrado o no pertenece al profesor"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for duplicate
        fecha = serializer.validated_data['fecha']
        if NotaAlumno.objects.filter(
            profesor_id=profesor_id,
            horario_id=horario_id,
            alumno_id=alumno_id,
            fecha=fecha,
        ).exists():
            return Response(
                {"detail": "Ya existe una nota para este alumno en esta clase y fecha"},
                status=status.HTTP_400_BAD_REQUEST
            )

        nota = NotaAlumno.objects.create(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
            horario=horario,
            alumno_id=alumno_id,
            fecha=fecha,
            contenido=serializer.validated_data.get('contenido', ''),
        )

        return Response(
            NotaAlumnoSerializer(nota).data,
            status=status.HTTP_201_CREATED
        )


class ProfesorNotaAlumnoDetailView(APIView):
    """
    GET/PUT/PATCH/DELETE /api/portal-docente/ciclos/{id}/notas-alumno/{nota_id}/
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_nota(self, nota_id, profesor_id, ciclo_id):
        try:
            return NotaAlumno.objects.get(
                id=nota_id,
                profesor_id=profesor_id,
                ciclo_id=ciclo_id,
            )
        except NotaAlumno.DoesNotExist:
            return None

    def get(self, request, ciclo_id, nota_id):
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(NotaAlumnoSerializer(nota).data)

    def put(self, request, ciclo_id, nota_id):
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = NotaAlumnoSerializer(
            nota,
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        # Update allowed fields
        nota.contenido = serializer.validated_data.get('contenido', nota.contenido)
        nota.save()

        return Response(NotaAlumnoSerializer(nota).data)

    def patch(self, request, ciclo_id, nota_id):
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = NotaAlumnoSerializer(
            nota,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        if 'contenido' in serializer.validated_data:
            nota.contenido = serializer.validated_data['contenido']
        nota.save()

        return Response(NotaAlumnoSerializer(nota).data)

    def delete(self, request, ciclo_id, nota_id):
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )
        nota.delete()
        return Response(
            {"detail": "Nota eliminada"},
            status=status.HTTP_200_OK
        )
