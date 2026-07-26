from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenBlacklistView

from .views import (
    CicloViewSet, TallerViewSet, ProfesorViewSet, AlumnoViewSet,
    HorarioViewSet, MatriculaViewSet, MatriculaHorarioViewSet,
    AsistenciaViewSet, ReciboViewSet, PagoProfesorViewSet,
    calcular_pago_profesor, detalle_clase_pago, resumen_ciclo, resumen_mensual_ciclo, ConfiguracionView,
    dashboard_kpis, dashboard_ingresos, PrecioPaqueteViewSet,
    EgresoViewSet, HoraTrabajadaViewSet, FeriadoViewSet
)
from .views.usuario_view import CambiarPasswordView

router = DefaultRouter()
router.register(r'ciclos', CicloViewSet)
router.register(r'talleres', TallerViewSet)
router.register(r'profesores', ProfesorViewSet)
router.register(r'alumnos', AlumnoViewSet)
router.register(r'horarios', HorarioViewSet)
router.register(r'matriculas', MatriculaViewSet)
router.register(r'matriculas-horarios', MatriculaHorarioViewSet)
router.register(r'asistencias', AsistenciaViewSet)
router.register(r'recibos', ReciboViewSet)
router.register(r'pagos-profesores', PagoProfesorViewSet)
router.register(r'precios', PrecioPaqueteViewSet, basename='precios')
router.register(r'egresos', EgresoViewSet, basename='egresos')
router.register(r'horas-trabajadas', HoraTrabajadaViewSet)

urlpatterns = [
    # Custom paths FIRST (before router)
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', TokenBlacklistView.as_view(), name='token_blacklist'),
    
    # Portal endpoints (student-facing API)
    path('portal/', include('core.views.portal.urls')),

    # Portal Docente endpoints (teacher-facing API)
    path('portal-docente/', include('core.views.portal_docente.urls')),
    
    # Usuarios
    path('usuarios/cambiar-password/', CambiarPasswordView.as_view(), name='cambiar-password'),
    
    # Configuracion (singleton - no usa router para evitar 405)
    path('config/', ConfiguracionView.as_view(), name='config'),
    
    # Pagos profesores
    path('pagos-profesores/calcular-periodo/', calcular_pago_profesor, name='calcular_pago'),
    path('pagos-profesores/detalle-clase/', detalle_clase_pago, name='detalle_clase_pago'),
    
    # Ciclos
    path('ciclos/<int:pk>/resumen/', resumen_ciclo, name='resumen_ciclo'),
    path('ciclos/<int:pk>/resumen-mensual/', resumen_mensual_ciclo, name='resumen_mensual_ciclo'),
    path('ciclos/<int:ciclo_id>/dashboard/', dashboard_kpis, name='dashboard-kpis'),
    path('ciclos/<int:ciclo_id>/dashboard/ingresos/', dashboard_ingresos, name='dashboard-ingresos'),
    
    # Endpoints por ciclo
    path('ciclos/<int:ciclo_id>/alumnos/', AlumnoViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-alumnos'),
    path('ciclos/<int:ciclo_id>/alumnos/<int:pk>/', AlumnoViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-alumnos-detail'),
    path('ciclos/<int:ciclo_id>/talleres/', TallerViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-talleres'),
    path('ciclos/<int:ciclo_id>/talleres/<int:pk>/', TallerViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-talleres-detail'),
    path('ciclos/<int:ciclo_id>/profesores/', ProfesorViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-profesores'),
    path('ciclos/<int:ciclo_id>/profesores/<int:pk>/', ProfesorViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-profesores-detail'),
    path('ciclos/<int:ciclo_id>/profesores/<int:pk>/detalle/', ProfesorViewSet.as_view({'get': 'detalle'}), name='ciclo-profesor-detalle'),
    path('ciclos/<int:ciclo_id>/horarios/', HorarioViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-horarios'),
    path('ciclos/<int:ciclo_id>/horarios/<int:pk>/', HorarioViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-horarios-detail'),
    path('ciclos/<int:ciclo_id>/matriculas/', MatriculaViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-matriculas'),
    path('ciclos/<int:ciclo_id>/matriculas/agrupadas/', MatriculaViewSet.as_view({'get': 'agrupadas'}), name='ciclo-matriculas-agrupadas'),
    path('ciclos/<int:ciclo_id>/matriculas/<int:pk>/detalle/', MatriculaViewSet.as_view({'get': 'detalle'}), name='ciclo-matricula-detalle'),
    path('ciclos/<int:ciclo_id>/alumnos/<int:pk>/detalle/', AlumnoViewSet.as_view({'get': 'detalle'}), name='ciclo-alumno-detalle'),
    path('ciclos/<int:ciclo_id>/asistencias/', AsistenciaViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-asistencias'),
    path('ciclos/<int:ciclo_id>/asistencias/por-horario/', AsistenciaViewSet.as_view({'get': 'por_horario'}), name='ciclo-asistencias-por-horario'),
    path('ciclos/<int:ciclo_id>/asistencias/por-dia/', AsistenciaViewSet.as_view({'get': 'por_dia'}), name='ciclo-asistencias-por-dia'),
    path('ciclos/<int:ciclo_id>/asistencias/recuperables/', AsistenciaViewSet.as_view({'get': 'recuperables'}), name='ciclo-asistencias-recuperables'),
    path('ciclos/<int:ciclo_id>/recibos/', ReciboViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-recibos'),
    path('ciclos/<int:ciclo_id>/feriados/', FeriadoViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-feriados'),
    path('ciclos/<int:ciclo_id>/feriados/<int:pk>/', FeriadoViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-feriados-detail'),
    path('ciclos/<int:ciclo_id>/feriados/<int:pk>/aplicar/', FeriadoViewSet.as_view({'post': 'aplicar'}), name='ciclo-feriados-aplicar'),
    path('ciclos/<int:ciclo_id>/precios/', PrecioPaqueteViewSet.as_view({'get': 'list'}), name='ciclo-precios'),
    path('ciclos/<int:ciclo_id>/egresos/', EgresoViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-egresos'),
    path('ciclos/<int:ciclo_id>/egresos/resumen/', EgresoViewSet.as_view({'get': 'resumen'}), name='ciclo-egresos-resumen'),
    path('profesores/<int:profesor_id>/historial-pagos/', EgresoViewSet.as_view({'get': 'historial_pagos'}), name='profesor-historial-pagos'),
    
    # Horas trabajadas por ciclo
    path('ciclos/<int:ciclo_id>/horas-trabajadas/', HoraTrabajadaViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-horas-trabajadas'),
    
    # Endpoints anidados para matrículas
    path('matriculas/<int:matricula_id>/horarios/', MatriculaHorarioViewSet.as_view({'get': 'list'}), name='matricula-horarios'),
    
    # Acción calcular precio (debe ir antes del router)
    path('recibos/calcular-precio/', ReciboViewSet.as_view({'post': 'calcular_precio'}), name='recibo-calcular-precio'),
    
    # Router URLs LAST
    path('', include(router.urls)),
]
