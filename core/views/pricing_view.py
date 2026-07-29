from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from core.services.price_engine import PriceEngine
from core.models import Matricula


class PriceEstimateView(APIView):
    """
    Calcula precios con detección de promociones para ítems conceptuales.
    No requiere matrículas reales — acepta [{tipo_taller, cantidad_clases}].
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        items = request.data.get('items', [])
        ciclo_id = request.data.get('ciclo_id')

        if not items or not ciclo_id:
            return Response({'error': 'items y ciclo_id son requeridos'}, status=400)
        if not isinstance(items, list):
            return Response({'error': 'items debe ser una lista'}, status=400)

        # Asignar IDs sintéticos para que PriceEngine.calculate funcione
        matriculas_data = [
            {'id': i, 'tipo_taller': it.get('tipo_taller'), 'cantidad_clases': it.get('cantidad_clases')}
            for i, it in enumerate(items)
        ]

        try:
            result = PriceEngine.calculate(matriculas_data, int(ciclo_id))
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        # Mapear resultados por índice (el matricula_id sintético)
        priced_map = {pi.matricula_id: pi for pi in result.items}

        response_items = []
        for i, item in enumerate(items):
            pi = priced_map.get(i)
            if pi:
                response_items.append({
                    'index': i,
                    'tipo_taller': item.get('tipo_taller'),
                    'cantidad_clases': item.get('cantidad_clases'),
                    'precio_original': pi.precio_individual,
                    'precio_final': pi.precio_final,
                    'descuento': pi.descuento,
                    'promo_aplicada': pi.promo_aplicada,
                    'precio_por_sesion': round(pi.precio_por_sesion, 2),
                })

        return Response({
            'items': response_items,
            'total_general': result.total_final,
            'descuento_total': result.descuento_total,
            'paquete_aplicado': result.paquete_aplicado,
        })


class PricePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        matricula_ids = request.data.get('matricula_ids', [])
        if not isinstance(matricula_ids, list) or not matricula_ids:
            return Response(
                {'matricula_ids': ['Se requiere una lista no vacía de matrículas.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        matriculas = Matricula.objects.filter(
            id__in=matricula_ids
        ).select_related('taller', 'alumno', 'ciclo')

        if matriculas.count() != len(set(matricula_ids)):
            return Response(
                {'matricula_ids': ['Una o más matrículas no existen.']},
                status=status.HTTP_404_NOT_FOUND
            )

        ciclo_ids = {m.ciclo_id for m in matriculas}
        if len(ciclo_ids) > 1:
            return Response(
                {'matricula_ids': ['Todas las matrículas deben pertenecer al mismo ciclo.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        ciclo_id = ciclo_ids.pop()
        matricula_map = {m.id: m for m in matriculas}

        matriculas_data = []
        for mid in matricula_ids:
            matricula = matricula_map[mid]
            matriculas_data.append({
                'id': matricula.id,
                'tipo_taller': matricula.taller.tipo,
                'cantidad_clases': matricula.sesiones_contratadas,
            })

        result = PriceEngine.calculate(matriculas_data, ciclo_id)

        items = []
        for item in result.items:
            matricula = matricula_map[item.matricula_id]
            items.append({
                'matricula_id': item.matricula_id,
                'alumno_nombre': f"{matricula.alumno.nombre} {matricula.alumno.apellido}".strip(),
                'taller_nombre': matricula.taller.nombre,
                'taller_tipo': matricula.taller.tipo,
                'sesiones_contratadas': item.cantidad_clases,
                'precio_original': item.precio_individual,
                'precio_final': item.precio_final,
                'descuento_aplicado': item.descuento,
                'promo_aplicada': item.promo_aplicada or 'individual',
                'precio_por_sesion_final': item.precio_por_sesion,
            })

        return Response({
            'items': items,
            'total_general': result.total_final,
            'descuento_total': result.descuento_total,
            'paquete_aplicado': result.paquete_aplicado,
        })


class PriceCalculateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        matricula_ids = request.data.get('matricula_ids', [])
        if not isinstance(matricula_ids, list) or not matricula_ids:
            return Response(
                {'matricula_ids': ['Se requiere una lista no vacía de matrículas.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        matriculas = Matricula.objects.filter(
            id__in=matricula_ids
        ).select_related('taller', 'alumno', 'ciclo')

        if matriculas.count() != len(set(matricula_ids)):
            return Response(
                {'matricula_ids': ['Una o más matrículas no existen.']},
                status=status.HTTP_404_NOT_FOUND
            )

        ciclo_ids = {m.ciclo_id for m in matriculas}
        if len(ciclo_ids) > 1:
            return Response(
                {'matricula_ids': ['Todas las matrículas deben pertenecer al mismo ciclo.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        ciclo_id = ciclo_ids.pop()
        matricula_map = {m.id: m for m in matriculas}

        matriculas_data = []
        for mid in matricula_ids:
            matricula = matricula_map[mid]
            matriculas_data.append({
                'id': matricula.id,
                'tipo_taller': matricula.taller.tipo,
                'cantidad_clases': matricula.sesiones_contratadas,
            })

        result = PriceEngine.calculate(matriculas_data, ciclo_id)

        items = [
            {
                'matricula_id': item.matricula_id,
                'alumno_nombre': f"{matricula_map[item.matricula_id].alumno.nombre} {matricula_map[item.matricula_id].alumno.apellido}".strip(),
                'taller_nombre': matricula_map[item.matricula_id].taller.nombre,
                'precio_original': item.precio_individual,
                'precio_final': item.precio_final,
                'descuento_aplicado': item.descuento,
                'promo_aplicada': item.promo_aplicada or 'individual',
            }
            for item in result.items
        ]

        return Response({
            'total_final': result.total_final,
            'descuento_total': result.descuento_total,
            'paquete_aplicado': result.paquete_aplicado,
            'items': items,
        })


class PriceIndividualView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tipo_taller = request.query_params.get('tipo_taller')
        sesiones = request.query_params.get('sesiones')
        ciclo_id = request.query_params.get('ciclo_id')

        if not tipo_taller or sesiones is None:
            return Response(
                {'error': 'Se requieren los parámetros tipo_taller y sesiones.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            sesiones = int(sesiones)
        except (ValueError, TypeError):
            return Response(
                {'sesiones': ['Debe ser un número entero.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        ciclo_id_int = None
        if ciclo_id:
            try:
                ciclo_id_int = int(ciclo_id)
            except (ValueError, TypeError):
                return Response(
                    {'ciclo_id': ['Debe ser un número entero.']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        result = PriceEngine.calculate_individual(tipo_taller, sesiones, ciclo_id_int)
        return Response(result)
