from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import NotaClase, Horario
from core.serializers.portal_docente.serializers import NotaClaseSerializer
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorNotasView(APIView):
    """
    GET/POST /api/portal-docente/ciclos/{id}/notas/

    GET: Returns notas filterable by horario_id and fecha.
    POST: Creates a new NotaClase for a class session.

    Query params for GET:
    - horario_id: filter by schedule (optional)
    - fecha: YYYY-MM-DD (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        queryset = NotaClase.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
        ).select_related('horario__taller').order_by('-fecha', '-created_at')

        # Filter by horario
        horario_id = request.query_params.get('horario_id')
        if horario_id:
            queryset = queryset.filter(horario_id=horario_id)

        # Filter by fecha
        fecha = request.query_params.get('fecha')
        if fecha:
            queryset = queryset.filter(fecha=fecha)

        return Response(
            NotaClaseSerializer(queryset, many=True).data
        )

    def post(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        serializer = NotaClaseSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        horario_id = serializer.validated_data['horario'].id

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
        if NotaClase.objects.filter(
            profesor_id=profesor_id,
            horario_id=horario_id,
            fecha=fecha,
        ).exists():
            return Response(
                {"detail": "Ya existe una nota para esta clase"},
                status=status.HTTP_400_BAD_REQUEST
            )

        nota = NotaClase.objects.create(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
            horario=horario,
            fecha=fecha,
            contenido=serializer.validated_data.get('contenido', ''),
        )

        return Response(
            NotaClaseSerializer(nota).data,
            status=status.HTTP_201_CREATED
        )


class ProfesorNotaDetailView(APIView):
    """
    GET/PUT/PATCH/DELETE /api/portal-docente/ciclos/{id}/notas/{nota_id}/
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_nota(self, nota_id, profesor_id, ciclo_id):
        try:
            return NotaClase.objects.get(
                id=nota_id,
                profesor_id=profesor_id,
                ciclo_id=ciclo_id,
            )
        except NotaClase.DoesNotExist:
            return None

    def get(self, request, ciclo_id, nota_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)
        nota = self._get_nota(nota_id, profesor_id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(NotaClaseSerializer(nota).data)

    def put(self, request, ciclo_id, nota_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)
        nota = self._get_nota(nota_id, profesor_id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = NotaClaseSerializer(
            nota,
            data=request.data,
            context={'request': request},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        # Update allowed fields
        nota.contenido = serializer.validated_data.get('contenido', nota.contenido)
        nota.save()

        return Response(NotaClaseSerializer(nota).data)

    def patch(self, request, ciclo_id, nota_id):
        return self.put(request, ciclo_id, nota_id)

    def delete(self, request, ciclo_id, nota_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)
        nota = self._get_nota(nota_id, profesor_id, ciclo_id)
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
