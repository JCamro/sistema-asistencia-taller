from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenBlacklistView

from .views import (
    CicloViewSet, TallerViewSet, ProfesorViewSet, AlumnoViewSet,
    HorarioViewSet, MatriculaViewSet, MatriculaHorarioViewSet,
    AsistenciaViewSet, ReciboViewSet, PagoProfesorViewSet,
    calcular_pago_profesor, detalle_clase_pago, resumen_ciclo, ConfiguracionViewSet,
    asistencia_por_horario, dashboard_kpis, PrecioPaqueteViewSet,
    EgresoViewSet, SetupView
)

router = DefaultRouter()
router.register(r'config', ConfiguracionViewSet, basename='config')
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

urlpatterns = [
    # Custom paths FIRST (before router)
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', TokenBlacklistView.as_view(), name='token_blacklist'),
    path('setup/', SetupView.as_view(), name='setup'),  # Temporal - eliminar después de usar
    
    path('pagos-profesores/calcular-periodo/', calcular_pago_profesor, name='calcular_pago'),
    path('pagos-profesores/detalle-clase/', detalle_clase_pago, name='detalle_clase_pago'),
    path('ciclos/<int:pk>/resumen/', resumen_ciclo, name='resumen_ciclo'),
    path('ciclos/<int:ciclo_id>/dashboard/', dashboard_kpis, name='dashboard-kpis'),
    
    # Endpoints por ciclo
    path('ciclos/<int:ciclo_id>/alumnos/', AlumnoViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-alumnos'),
    path('ciclos/<int:ciclo_id>/alumnos/<int:pk>/', AlumnoViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-alumnos-detail'),
    path('ciclos/<int:ciclo_id>/talleres/', TallerViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-talleres'),
    path('ciclos/<int:ciclo_id>/talleres/<int:pk>/', TallerViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-talleres-detail'),
    path('ciclos/<int:ciclo_id>/profesores/', ProfesorViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-profesores'),
    path('ciclos/<int:ciclo_id>/profesores/<int:pk>/', ProfesorViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-profesores-detail'),
    path('ciclos/<int:ciclo_id>/horarios/', HorarioViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-horarios'),
    path('ciclos/<int:ciclo_id>/horarios/<int:pk>/', HorarioViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='ciclo-horarios-detail'),
    path('ciclos/<int:ciclo_id>/matriculas/', MatriculaViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-matriculas'),
    path('ciclos/<int:ciclo_id>/asistencias/', AsistenciaViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-asistencias'),
    path('ciclos/<int:ciclo_id>/asistencias/por-horario/', asistencia_por_horario, name='ciclo-asistencias-por-horario'),
    path('ciclos/<int:ciclo_id>/recibos/', ReciboViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-recibos'),
    path('ciclos/<int:ciclo_id>/precios/', PrecioPaqueteViewSet.as_view({'get': 'list'}), name='ciclo-precios'),
    path('ciclos/<int:ciclo_id>/egresos/', EgresoViewSet.as_view({'get': 'list', 'post': 'create'}), name='ciclo-egresos'),
    path('ciclos/<int:ciclo_id>/egresos/resumen/', EgresoViewSet.as_view({'get': 'resumen'}), name='ciclo-egresos-resumen'),
    path('profesores/<int:profesor_id>/historial-pagos/', EgresoViewSet.as_view({'get': 'historial_pagos'}), name='profesor-historial-pagos'),
    
    # Endpoints anidados para matrículas
    path('matriculas/<int:matricula_id>/horarios/', MatriculaHorarioViewSet.as_view({'get': 'list'}), name='matricula-horarios'),
    
    # Router URLs LAST
    path('', include(router.urls)),
]
