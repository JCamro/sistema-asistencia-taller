from django.urls import path
from .auth_view import ProfesorLoginView, ProfesorLogoutView, ProfesorRefreshView
from .me_view import ProfesorMeView
from .ciclos_view import ProfesorCiclosView
from .horarios_view import ProfesorHorariosView, ProfesorHorarioDetalleView
from .asistencia_view import ProfesorAsistenciasView
from .horas_trabajadas_view import ProfesorHorasTrabajadasView
from .dashboard_view import ProfesorDashboardView
from .notas_view import ProfesorNotasView, ProfesorNotaDetailView

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
    path('ciclos/<int:ciclo_id>/horas-trabajadas/', ProfesorHorasTrabajadasView.as_view(), name='portal-docente-horas-trabajadas'),
    path('ciclos/<int:ciclo_id>/dashboard/', ProfesorDashboardView.as_view(), name='portal-docente-dashboard'),
    path('ciclos/<int:ciclo_id>/notas/', ProfesorNotasView.as_view(), name='portal-docente-notas'),
    path('ciclos/<int:ciclo_id>/notas/<int:nota_id>/', ProfesorNotaDetailView.as_view(), name='portal-docente-nota-detalle'),
]
