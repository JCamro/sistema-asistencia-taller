from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import PrecioPaquete, Ciclo
from ..serializers import PrecioPaqueteSerializer


class PrecioPaqueteViewSet(viewsets.ModelViewSet):
    serializer_class = PrecioPaqueteSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = PrecioPaquete.objects.select_related('ciclo').all()
        # Read ciclo_id from URL kwargs (/ciclos/<id>/precios/) or query params (?ciclo=<id>)
        ciclo_id = self.kwargs.get('ciclo_id') or self.request.query_params.get('ciclo')
        if ciclo_id:
            qs = qs.filter(ciclo_id=ciclo_id)
        return qs
    
    @action(detail=False, methods=['get'], url_path='activos')
    def precios_activos(self, request):
        """Get active prices for a cycle, with global fallback"""
        ciclo_id = request.query_params.get('ciclo_id')
        if not ciclo_id:
            return Response({'error': 'ciclo_id requerido'}, status=400)
        
        # Get cycle-specific prices first, then global fallback
        precios = PrecioPaquete.objects.filter(ciclo_id=ciclo_id, activo=True)
        if not precios.exists():
            precios = PrecioPaquete.objects.filter(ciclo__isnull=True, activo=True)
        
        serializer = self.get_serializer(precios, many=True)
        return Response(serializer.data)