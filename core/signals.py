"""
Signals para el core del sistema de asistencia.

Maneja la creación automática de registros HoraTrabajada cuando
se guardan asistencias con estado 'asistio'.
"""
from decimal import Decimal

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Asistencia, HoraTrabajada
from .services.hora_trabajada_service import HoraTrabajadaService


@receiver(post_save, sender=Asistencia)
def auto_create_hora_trabajada(sender, instance, created, **kwargs):
    """
    Crea o actualiza automáticamente un registro HoraTrabajada
    cuando una Asistencia se guarda con estado='asistio'.

    Si ya existe un registro manual (created_from='admin_manual')
    para el mismo profesor, horario, fecha y tipo, no lo sobreescribe.
    """
    if instance.estado != 'asistio':
        return

    horario = instance.horario
    if not horario:
        return

    fecha = instance.fecha
    profesor = horario.profesor
    ciclo = horario.ciclo

    # No sobreescribir registros manuales existentes
    if HoraTrabajada.objects.filter(
        profesor=profesor,
        horario=horario,
        fecha=fecha,
        tipo='clase_regular',
        created_from='admin_manual',
    ).exists():
        return

    # Contar alumnos asistentes para este (horario, fecha)
    num_alumnos = Asistencia.objects.filter(
        horario=horario,
        fecha=fecha,
        estado='asistio',
    ).count()

    # Obtener asistentes para cálculo de valor generado
    asistentes = Asistencia.objects.filter(
        horario=horario,
        fecha=fecha,
        estado='asistio',
    ).select_related('matricula')

    # Calcular montos
    config_snapshot = HoraTrabajadaService._get_config_snapshot()
    horario_meta = {
        'tipo_pago': horario.tipo_pago,
        'monto_fijo': horario.monto_fijo or Decimal('0.00'),
    }
    montos = HoraTrabajadaService._calcular_montos_para_clase(
        num_alumnos, asistentes, horario_meta, config_snapshot
    )

    ganancia_taller = montos['valor_generado'] - montos['monto_profesor']

    # Crear o actualizar el registro de hora trabajada
    HoraTrabajada.objects.update_or_create(
        profesor=profesor,
        horario=horario,
        fecha=fecha,
        tipo='clase_regular',
        defaults={
            'ciclo': ciclo,
            'horas_trabajadas': Decimal('1.00'),
            'estado': 'aprobada',
            'num_alumnos': num_alumnos,
            'valor_generado': montos['valor_generado'],
            'monto_base': montos['monto_base'],
            'monto_adicional': montos['monto_adicional'],
            'monto_profesor': montos['monto_profesor'],
            'ganancia_taller': ganancia_taller,
            'config_snapshot': config_snapshot,
            'created_from': 'asistencia_auto',
        },
    )
