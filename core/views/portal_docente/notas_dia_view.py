from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import NotaDia
from core.serializers.portal_docente.serializers import NotaDiaSerializer
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorNotasDiaView(APIView):
    """
    GET/POST /api/portal-docente/ciclos/{id}/notas-dia/

    GET: Returns day notes filterable by fecha.
    POST: Creates a new NotaDia for a specific date.

    Query params for GET:
    - fecha: YYYY-MM-DD (optional, defaults to all)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
        profesor_id = request.user.id

        queryset = NotaDia.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
        ).order_by('-fecha', '-created_at')

        # Filter by fecha
        fecha = request.query_params.get('fecha')
        if fecha:
            queryset = queryset.filter(fecha=fecha)

        return Response(
            NotaDiaSerializer(queryset, many=True).data
        )

    def post(self, request, ciclo_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
        profesor_id = request.user.id

        serializer = NotaDiaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fecha = serializer.validated_data['fecha']

        # Check for duplicate (unique_together: ciclo + profesor + fecha)
        if NotaDia.objects.filter(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
            fecha=fecha,
        ).exists():
            return Response(
                {"detail": "Ya existe una nota para este día"},
                status=status.HTTP_400_BAD_REQUEST
            )

        nota = NotaDia.objects.create(
            profesor_id=profesor_id,
            ciclo_id=ciclo_id,
            fecha=fecha,
            contenido=serializer.validated_data.get('contenido', ''),
        )

        return Response(
            NotaDiaSerializer(nota).data,
            status=status.HTTP_201_CREATED
        )


class ProfesorNotaDiaDetailView(APIView):
    """
    GET/PUT/PATCH/DELETE /api/portal-docente/ciclos/{id}/notas-dia/{nota_id}/
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_nota(self, nota_id, profesor_id, ciclo_id):
        try:
            return NotaDia.objects.get(
                id=nota_id,
                profesor_id=profesor_id,
                ciclo_id=ciclo_id,
            )
        except NotaDia.DoesNotExist:
            return None

    def get(self, request, ciclo_id, nota_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(NotaDiaSerializer(nota).data)

    def put(self, request, ciclo_id, nota_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = NotaDiaSerializer(
            nota,
            data=request.data,
            partial=False,
        )
        serializer.is_valid(raise_exception=True)

        # Update allowed fields
        nota.contenido = serializer.validated_data.get('contenido', nota.contenido)
        nota.save()

        return Response(NotaDiaSerializer(nota).data)

    def patch(self, request, ciclo_id, nota_id):
        nota = self._get_nota(nota_id, request.user.id, ciclo_id)
        if not nota:
            return Response(
                {"detail": "Nota no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = NotaDiaSerializer(
            nota,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        if 'contenido' in serializer.validated_data:
            nota.contenido = serializer.validated_data['contenido']
        nota.save()

        return Response(NotaDiaSerializer(nota).data)

    def delete(self, request, ciclo_id, nota_id):
        get_profesor_for_ciclo(request.user.dni, ciclo_id)  # validate ciclo active
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
