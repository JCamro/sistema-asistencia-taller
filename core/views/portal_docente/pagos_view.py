from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg, Max, Q

from core.models import Egreso
from core.serializers.portal_docente.serializers import EgresoPortalSerializer
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorPagosView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/pagos/

    Returns Egreso records (tipo='pago_profesor') for the authenticated professor.
    Includes stats: total_pagado, cantidad_pagos, promedio_pago, ultimo_pago.

    Query params:
    - fecha_desde: YYYY-MM-DD (optional)
    - fecha_hasta: YYYY-MM-DD (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        qs = Egreso.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            tipo='pago_profesor',
        )

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)

        qs = qs.order_by('-fecha')

        serializer = EgresoPortalSerializer(qs, many=True)

        stats = qs.aggregate(
            total_pagado=Sum('monto', filter=Q(estado='cancelado')),
            cantidad_pagos=Count('id'),
            promedio_pago=Avg('monto', filter=Q(estado='cancelado')),
            ultimo_pago=Max('fecha', filter=Q(estado='cancelado')),
        )

        stats['total_pagado'] = float(stats['total_pagado'] or 0)
        stats['cantidad_pagos'] = stats['cantidad_pagos'] or 0
        stats['promedio_pago'] = float(stats['promedio_pago'] or 0)
        stats['ultimo_pago'] = str(stats['ultimo_pago']) if stats['ultimo_pago'] else None

        return Response({
            'pagos': serializer.data,
            'stats': stats,
        })
