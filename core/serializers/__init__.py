from .ciclo import CicloSerializer, CicloListSerializer
from .taller import TallerSerializer, TallerListSerializer
from .profesor import ProfesorSerializer, ProfesorListSerializer
from .alumno import AlumnoSerializer, AlumnoListSerializer
from .horario import HorarioSerializer, HorarioListSerializer
from .matricula import MatriculaSerializer, MatriculaListSerializer
from .matricula_horario import MatriculaHorarioSerializer, MatriculaHorarioListSerializer
from .asistencia import AsistenciaSerializer, AsistenciaListSerializer
from .recibo import ReciboSerializer, ReciboListSerializer, CalcularPrecioSerializer
from .pago_profesor import PagoProfesorSerializer, PagoProfesorListSerializer, PagoProfesorDetalleSerializer
from .configuracion import ConfiguracionSerializer
from .traspaso import TraspasoSerializer, HistorialTraspasoSerializer
from .precio_paquete import PrecioPaqueteSerializer
from .egreso import EgresoSerializer, EgresoListSerializer
