"""
Helpers compartidos para serializers del core.
"""
from functools import reduce


def get_nombre_completo(obj):
    """Retorna 'apellido, nombre' para cualquier objeto con esos atributos."""
    return f"{obj.apellido}, {obj.nombre}"


def get_alumnos_nombres(obj):
    """
    Retorna lista de 'nombre apellido' para todas las matrículas de un recibo.
    Evita duplicados preservando el orden.
    """
    nombres = []
    for rm in obj.matriculas.select_related('matricula__alumno'):
        a = rm.matricula.alumno
        nombre = f"{a.nombre} {a.apellido}"
        if nombre not in nombres:
            nombres.append(nombre)
    return nombres


def get_profesor_nombre(obj, attr='profesor'):
    """Retorna 'apellido, nombre' para el profesor del atributo dado."""
    profesor = getattr(obj, attr)
    if profesor is None:
        return None
    return f"{profesor.apellido}, {profesor.nombre}"


def format_nombre(apellido, nombre):
    """Retorna 'apellido, nombre' dados los dos strings."""
    return f"{apellido}, {nombre}"


def get_estado_matricula(matricula):
    """
    Retorna el estado calculado de una matrícula.
    Reutiliza el campo anotado estado_calculado si existe,
    de lo contrario calcula con la misma lógica del serializer.
    """
    if hasattr(matricula, 'estado_calculado') and matricula.estado_calculado is not None:
        return matricula.estado_calculado
    if not matricula.activo:
        return 'inactiva'
    if matricula.concluida:
        return 'concluida'
    from ..models import ReciboMatricula
    tiene_recibo = ReciboMatricula.objects.filter(
        matricula=matricula,
        recibo__estado__in=['pagado', 'pendiente']
    ).exists()
    return 'activa' if tiene_recibo else 'no_procesado'


def get_recibo_estado(matricula):
    """
    Retorna el estado del recibo asociado a una matrícula.
    Prioridad: pagado > pendiente > anulado > sin_recibo.
    """
    from ..models import ReciboMatricula
    recibos = ReciboMatricula.objects.filter(
        matricula=matricula
    ).select_related('recibo').values_list('recibo__estado', flat=True)

    estados = set(recibos)
    if 'pagado' in estados:
        return 'pagado'
    if 'pendiente' in estados:
        return 'pendiente'
    if 'anulado' in estados:
        return 'anulado'
    return 'sin_recibo'
