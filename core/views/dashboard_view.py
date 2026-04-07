from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q, Count, F, OuterRef, Exists
from core.models import Ciclo, Matricula, Asistencia, Recibo, ReciboMatricula


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_kpis(request, ciclo_id):
    """
    Returns 4 KPIs for the admin dashboard:
    1. Alumnos sin asistencia registrada hoy (tienen clase hoy pero no registro de asistencia)
    2. Matrículas por concluir (menos de 3 sesiones disponibles)
    3. Matrículas sin recibo
    4. Matrículas sin pago completo (recibo pendiente)
    """
    today = timezone.now().date()
    
    # KPI 1: Alumnos sin asistencia hoy
    # Matrículas that have classes today (match dia_semana) but no asistencia registered
    today_weekday = today.weekday()  # 0=Monday, 6=Sunday
    
    # Get all active matrículas that have class today
    from core.models import MatriculaHorario
    matriculas_con_clase_hoy_ids = MatriculaHorario.objects.filter(
        matricula__ciclo_id=ciclo_id,
        matricula__activo=True,
        matricula__concluida=False,
        horario__dia_semana=today_weekday
    ).values_list('matricula_id', flat=True).distinct()
    
    # Get matrículas with asistencia today
    matriculas_con_asistencia_hoy_ids = Asistencia.objects.filter(
        fecha=today,
        matricula_id__in=matriculas_con_clase_hoy_ids
    ).values_list('matricula_id', flat=True)
    
    # Count those without asistencia
    alumnos_sin_asistencia = len(set(matriculas_con_clase_hoy_ids) - set(matriculas_con_asistencia_hoy_ids))
    
    # KPI 2: Matrículas por concluir (sesiones disponibles < 3)
    # Annotate sesiones consumidas at database level
    matriculas_con_sesiones = Matricula.objects.filter(
        ciclo_id=ciclo_id,
        activo=True,
        concluida=False
    ).annotate(
        sesiones_consumidas_count=Count(
            'asistencias',
            filter=Q(asistencias__estado__in=['asistio', 'falta_grave'])
        )
    )
    
    # Count those with less than 3 available sessions using aggregate
    # Filter: sesiones_contratadas - sesiones_consumidas < 3
    # Equivalent: sesiones_consumidas > sesiones_contratadas - 3
    matriculas_por_concluir = matriculas_con_sesiones.filter(
        sesiones_consumidas_count__gt=F('sesiones_contratadas') - 3
    ).count()
    
    # KPI 3: Matrículas sin recibo
    # Use Exists subquery for better performance (inline to maintain OuterRef context)
    matriculas_sin_recibo = Matricula.objects.filter(
        ciclo_id=ciclo_id,
        activo=True,
        concluida=False
    ).exclude(
        Exists(ReciboMatricula.objects.filter(
            matricula=OuterRef('pk'),
            recibo__ciclo_id=ciclo_id
        ))
    ).count()
    
    # KPI 4: Matrículas sin pago completo
    # Matrículas that have a Recibo but it's not fully paid (estado != 'pagado')
    matriculas_sin_pago_completo = Matricula.objects.filter(
        ciclo_id=ciclo_id,
        activo=True,
        concluida=False
    ).filter(
        Exists(ReciboMatricula.objects.filter(
            matricula=OuterRef('pk'),
            recibo__ciclo_id=ciclo_id
        )),
        Exists(ReciboMatricula.objects.filter(
            matricula=OuterRef('pk'),
            recibo__ciclo_id=ciclo_id
        ).exclude(recibo__estado='pagado'))
    ).count()
    
    return Response({
        'alumnos_sin_asistencia_hoy': alumnos_sin_asistencia,
        'matriculas_por_concluir': matriculas_por_concluir,
        'matriculas_sin_recibo': matriculas_sin_recibo,
        'matriculas_sin_pago_completo': matriculas_sin_pago_completo,
    })