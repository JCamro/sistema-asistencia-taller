from .ciclo import Ciclo
from .taller import Taller
from .profesor import Profesor
from .alumno import Alumno
from .horario import Horario
from .matricula import Matricula
from .matricula_horario import MatriculaHorario
from .asistencia import Asistencia
from .recibo import Recibo
from .recibo_matricula import ReciboMatricula
from .pago_profesor import PagoProfesor
from .pago_profesor_detalle import PagoProfesorDetalle
from .configuracion import Configuracion
from .historial_traspaso import HistorialTraspaso
from .precio_paquete import PrecioPaquete
from .egreso import Egreso

__all__ = [
    'Ciclo',
    'Taller',
    'Profesor',
    'Alumno',
    'Horario',
    'Matricula',
    'MatriculaHorario',
    'Asistencia',
    'Recibo',
    'ReciboMatricula',
    'PagoProfesor',
    'PagoProfesorDetalle',
    'Configuracion',
    'HistorialTraspaso',
    'PrecioPaquete',
    'Egreso',
]
