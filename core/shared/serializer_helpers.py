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
