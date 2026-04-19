from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import Recibo, ReciboMatricula
from core.serializers.portal.portal_serializers import PortalReciboSerializer
from core.authentication import PortalJWTAuthentication


class PortalPagosView(APIView):
    """
    GET /api/portal/me/pagos/

    Returns receipts for the authenticated student with optional filtering.

    Query params:
    - ciclo_id: filter by cycle (required)
    - filtro: 'pendientes' (default), 'pagados', 'todos'
        - pendientes: saldo_pendiente > 0 AND estado != 'anulado'
        - pagados: monto_pagado >= monto_total AND estado != 'anulado'
        - todos: exclude only estado == 'anulado'
    """
    authentication_classes = [PortalJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        alumno_ids = request.user.alumno_ids
        ciclo_id = request.query_params.get('ciclo_id')
        filtro = request.query_params.get('filtro', 'pendientes')
        
        if not ciclo_id:
            return Response(
                {"detail": "ciclo_id es requerido"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate filtro param
        valores_validos = ['pendientes', 'pagados', 'todos']
        if filtro not in valores_validos:
            return Response(
                {"detail": f"filtro debe ser uno de: {', '.join(valores_validos)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get receipt IDs where this student has a matricula
        # Use alumno_ids to match across all Alumno records with same DNI
        recibo_ids = ReciboMatricula.objects.filter(
            matricula__alumno_id__in=alumno_ids,
            matricula__ciclo_id=ciclo_id
        ).values_list('recibo_id', flat=True).distinct()
        
        # Base queryset excluding anulados
        recibos = Recibo.objects.filter(
            id__in=recibo_ids,
            ciclo_id=ciclo_id
        ).exclude(
            estado='anulado'
        ).order_by('-fecha_emision')
        
        # Apply filtro
        if filtro == 'pendientes':
            # saldo_pendiente > 0
            recibos_filtrados = [
                r for r in recibos if r.saldo_pendiente > 0
            ]
        elif filtro == 'pagados':
            # monto_pagado >= monto_total
            recibos_filtrados = [
                r for r in recibos if r.monto_pagado >= r.monto_total
            ]
        else:  # 'todos'
            recibos_filtrados = list(recibos)
        
        return Response(
            PortalReciboSerializer(recibos_filtrados, many=True).data
        )
