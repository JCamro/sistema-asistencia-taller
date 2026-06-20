from django.urls import path
from .auth_view import ProfesorLoginView, ProfesorLogoutView, ProfesorRefreshView
from .me_view import ProfesorMeView
from .ciclos_view import ProfesorCiclosView
from .horarios_view import ProfesorHorariosView, ProfesorHorarioDetalleView
from .asistencia_view import ProfesorAsistenciasView, ProfesorAsistenciasPorHorarioView
from .horas_trabajadas_view import ProfesorHorasTrabajadasView
from .dashboard_view import ProfesorDashboardView
from .notas_view import ProfesorNotasView, ProfesorNotaDetailView
from .notas_dia_view import ProfesorNotasDiaView, ProfesorNotaDiaDetailView
from .notas_alumno_view import ProfesorNotasAlumnoView, ProfesorNotaAlumnoDetailView
from .pagos_view import ProfesorPagosView
from .alumnos_view import ProfesorAlumnosCartillaView

urlpatterns = [
    # Auth
    path('auth/login/', ProfesorLoginView.as_view(), name='portal-docente-login'),
    path('auth/logout/', ProfesorLogoutView.as_view(), name='portal-docente-logout'),
    path('auth/refresh/', ProfesorRefreshView.as_view(), name='portal-docente-refresh'),

    # Profile
    path('me/', ProfesorMeView.as_view(), name='portal-docente-me'),

    # Cycles (where profesor has horarios)
    path('ciclos/', ProfesorCiclosView.as_view(), name='portal-docente-ciclos'),

    # Cycle-scoped endpoints
    path('ciclos/<int:ciclo_id>/horarios/', ProfesorHorariosView.as_view(), name='portal-docente-horarios'),
    path('ciclos/<int:ciclo_id>/horarios/<int:horario_id>/', ProfesorHorarioDetalleView.as_view(), name='portal-docente-horario-detalle'),
    path('ciclos/<int:ciclo_id>/asistencias/', ProfesorAsistenciasView.as_view(), name='portal-docente-asistencias'),
    path('ciclos/<int:ciclo_id>/asistencias/por-horario/', ProfesorAsistenciasPorHorarioView.as_view(), name='portal-docente-asistencias-por-horario'),
    path('ciclos/<int:ciclo_id>/horas-trabajadas/', ProfesorHorasTrabajadasView.as_view(), name='portal-docente-horas-trabajadas'),
    path('ciclos/<int:ciclo_id>/dashboard/', ProfesorDashboardView.as_view(), name='portal-docente-dashboard'),
    path('ciclos/<int:ciclo_id>/notas/', ProfesorNotasView.as_view(), name='portal-docente-notas'),
    path('ciclos/<int:ciclo_id>/notas/<int:nota_id>/', ProfesorNotaDetailView.as_view(), name='portal-docente-nota-detalle'),
    path('ciclos/<int:ciclo_id>/pagos/', ProfesorPagosView.as_view(), name='portal-docente-pagos'),
    path('ciclos/<int:ciclo_id>/alumnos/', ProfesorAlumnosCartillaView.as_view(), name='portal-docente-alumnos'),

    # Day notes
    path('ciclos/<int:ciclo_id>/notas-dia/', ProfesorNotasDiaView.as_view(), name='portal-docente-notas-dia'),
    path('ciclos/<int:ciclo_id>/notas-dia/<int:nota_id>/', ProfesorNotaDiaDetailView.as_view(), name='portal-docente-nota-dia-detalle'),

    # Student notes
    path('ciclos/<int:ciclo_id>/notas-alumno/', ProfesorNotasAlumnoView.as_view(), name='portal-docente-notas-alumno'),
    path('ciclos/<int:ciclo_id>/notas-alumno/<int:nota_id>/', ProfesorNotaAlumnoDetailView.as_view(), name='portal-docente-nota-alumno-detalle'),
]
