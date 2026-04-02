# Views init
from .alumno_view import AlumnoViewSet
from .taller_view import TallerViewSet
from .profesor_view import ProfesorViewSet
from .horario_view import HorarioViewSet
from .matricula_view import MatriculaViewSet
from .matricula_horario_view import MatriculaHorarioViewSet
from .asistencia_view import AsistenciaViewSet, asistencia_por_horario
from .recibo_view import ReciboViewSet
from .ciclo_view import CicloViewSet
from .configuracion_view import ConfiguracionViewSet
from .pago_profesor_view import PagoProfesorViewSet, calcular_pago_profesor, detalle_clase_pago, resumen_ciclo
from .dashboard_view import dashboard_kpis
from .precio_paquete_view import PrecioPaqueteViewSet
