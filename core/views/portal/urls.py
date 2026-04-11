from django.urls import path
from .auth_view import PortalLoginView, PortalLogoutView, PortalRefreshView
from .me_view import PortalMeView
from .ciclos_view import PortalCiclosView
from .matriculas_view import PortalMatriculasView, PortalMatriculasHistorialView
from .asistencia_view import PortalAsistenciasView, PortalAsistenciasDetalleView
from .horarios_view import PortalHorariosView
from .pagos_view import PortalPagosView
from .dashboard_view import PortalDashboardView

urlpatterns = [
    # Auth
    path('auth/login/', PortalLoginView.as_view(), name='portal-login'),
    path('auth/logout/', PortalLogoutView.as_view(), name='portal-logout'),
    path('auth/refresh/', PortalRefreshView.as_view(), name='portal-refresh'),
    
    # Profile & Cycles
    path('me/', PortalMeView.as_view(), name='portal-me'),
    path('me/ciclos/', PortalCiclosView.as_view(), name='portal-ciclos'),
    
    # Data endpoints
    path('me/matriculas/', PortalMatriculasView.as_view(), name='portal-matriculas'),
    path('me/matriculas/historial/', PortalMatriculasHistorialView.as_view(), name='portal-matriculas-historial'),
    path('me/asistencias/', PortalAsistenciasView.as_view(), name='portal-asistencias'),
    path('me/asistencias/detalle/', PortalAsistenciasDetalleView.as_view(), name='portal-asistencias-detalle'),
    path('me/horarios/', PortalHorariosView.as_view(), name='portal-horarios'),
    path('me/pagos/', PortalPagosView.as_view(), name='portal-pagos'),
    path('me/dashboard/', PortalDashboardView.as_view(), name='portal-dashboard'),
]
