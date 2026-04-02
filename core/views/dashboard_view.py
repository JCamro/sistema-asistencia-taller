from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q, Count
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
    
    # Base queryset: active matrículas in the cycle
    matriculas = Matricula.objects.filter(
        ciclo_id=ciclo_id,
        activo=True,
        concluida=False
    )
    
    # KPI 1: Alumnos sin asistencia hoy
    # Matrículas that have classes today (match dia_semana) but no asistencia registered
    today_weekday = today.weekday()  # 0=Monday, 6=Sunday
    
    # Get all active matrículas that have class today
    from core.models import MatriculaHorario
    matriculas_con_clase_hoy_ids = MatriculaHorario.objects.filter(
        matricula__in=matriculas,
        horario__dia_semana=today_weekday
    ).values_list('matricula_id', flat=True).distinct()
    
    # Get matrículas with asistencia today
    matriculas_con_asistencia_hoy = Asistencia.objects.filter(
        fecha=today,
        matricula_id__in=matriculas_con_clase_hoy_ids
    ).values_list('matricula_id', flat=True).distinct()
    
    # Count those without asistencia
    alumnos_sin_asistencia = matriculas.filter(
        id__in=matriculas_con_clase_hoy_ids
    ).exclude(
        id__in=matriculas_con_asistencia_hoy
    ).count()
    
    # KPI 2: Matrículas por concluir (sesiones disponibles < 3)
    # Calculate for each matrícula: sesiones_disponibles = sesiones_contratadas - sesiones_consumidas
    from django.db.models import Count
    
    # Aggregate sesiones consumidas per matrícula
    sesiones_por_matricula = Asistencia.objects.filter(
        matricula__in=matriculas
    ).values('matricula_id').annotate(
        total_asistencias=Count('id')
    )
    
    # Create a dict for quick lookup
    sesiones_dict = {item['matricula_id']: item['total_asistencias'] for item in sesiones_por_matricula}
    
    # Count matrículas with less than 3 available sessions
    matriculas_por_concluir = 0
    for m in matriculas:
        consumed = sesiones_dict.get(m.id, 0)
        available = m.sesiones_contratadas - consumed
        if available < 3:
            matriculas_por_concluir += 1
    
    # KPI 3: Matrículas sin recibo
    # Get all matrículas that have at least one ReciboMatricula
    matriculas_con_recibo_ids = ReciboMatricula.objects.filter(
        recibo__ciclo_id=ciclo_id
    ).values_list('matricula_id', flat=True).distinct()
    
    matriculas_sin_recibo = matriculas.exclude(
        id__in=matriculas_con_recibo_ids
    ).count()
    
    # KPI 4: Matrículas sin pago completo
    # Matrículas that have a Recibo but it's not fully paid (estado != 'pagado')
    matriculas_con_recibo_pendiente_ids = ReciboMatricula.objects.filter(
        recibo__ciclo_id=ciclo_id
    ).exclude(
        recibo__estado='pagado'
    ).values_list('matricula_id', flat=True).distinct()
    
    matriculas_sin_pago_completo = matriculas.filter(
        id__in=matriculas_con_recibo_pendiente_ids
    ).count()
    
    return Response({
        'alumnos_sin_asistencia_hoy': alumnos_sin_asistencia,
        'matriculas_por_concluir': matriculas_por_concluir,
        'matriculas_sin_recibo': matriculas_sin_recibo,
        'matriculas_sin_pago_completo': matriculas_sin_pago_completo,
    })