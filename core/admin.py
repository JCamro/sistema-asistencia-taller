from django.contrib import admin
from .models import (
    Ciclo, Taller, Profesor, Alumno, Horario,
    Matricula, MatriculaHorario, Asistencia,
    Recibo, ReciboMatricula, PagoProfesor, Configuracion
)


@admin.register(Ciclo)
class CicloAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'tipo', 'fecha_inicio', 'fecha_fin', 'activo']
    list_filter = ['tipo', 'activo']
    search_fields = ['nombre']


@admin.register(Taller)
class TallerAdmin(admin.ModelAdmin):
    list_display = ['ciclo', 'nombre', 'activo']
    list_filter = ['ciclo', 'activo']
    search_fields = ['nombre', 'ciclo__nombre']


@admin.register(Profesor)
class ProfesorAdmin(admin.ModelAdmin):
    list_display = ['ciclo', 'nombre', 'apellido', 'dni', 'activo', 'es_gerente']
    list_filter = ['ciclo', 'activo', 'es_gerente']
    search_fields = ['nombre', 'apellido', 'dni']


@admin.register(Alumno)
class AlumnoAdmin(admin.ModelAdmin):
    list_display = ['ciclo', 'nombre', 'apellido', 'dni', 'activo']
    list_filter = ['ciclo', 'activo']
    search_fields = ['nombre', 'apellido', 'dni']


@admin.register(Horario)
class HorarioAdmin(admin.ModelAdmin):
    list_display = ['ciclo', 'taller', 'profesor', 'dia_semana', 'hora_inicio', 'hora_fin', 'cupo_maximo', 'activo']
    list_filter = ['ciclo', 'taller', 'profesor', 'dia_semana']
    search_fields = ['taller__nombre', 'profesor__nombre']


@admin.register(Matricula)
class MatriculaAdmin(admin.ModelAdmin):
    list_display = ['alumno', 'ciclo', 'taller', 'sesiones_contratadas', 'precio_total', 'activo', 'concluida']
    list_filter = ['ciclo', 'taller', 'activo', 'concluida']
    search_fields = ['alumno__nombre', 'alumno__apellido']


@admin.register(MatriculaHorario)
class MatriculaHorarioAdmin(admin.ModelAdmin):
    list_display = ['matricula', 'horario']
    search_fields = ['matricula__alumno__nombre']


@admin.register(Asistencia)
class AsistenciaAdmin(admin.ModelAdmin):
    list_display = ['matricula', 'horario', 'profesor', 'fecha', 'estado']
    list_filter = ['estado', 'fecha', 'horario']
    search_fields = ['matricula__alumno__nombre']


@admin.register(Recibo)
class ReciboAdmin(admin.ModelAdmin):
    list_display = ['numero', 'alumno', 'ciclo', 'monto_total', 'monto_pagado', 'estado', 'fecha_emision']
    list_filter = ['estado', 'ciclo']
    search_fields = ['numero', 'alumno__nombre']


@admin.register(ReciboMatricula)
class ReciboMatriculaAdmin(admin.ModelAdmin):
    list_display = ['recibo', 'matricula', 'monto']


@admin.register(PagoProfesor)
class PagoProfesorAdmin(admin.ModelAdmin):
    list_display = ['profesor', 'ciclo', 'monto_calculado', 'monto_final', 'estado', 'fecha_pago']
    list_filter = ['estado', 'ciclo']
    search_fields = ['profesor__nombre']


@admin.register(Configuracion)
class ConfiguracionAdmin(admin.ModelAdmin):
    list_display = ['id', 'ciclo_activo', 'updated_at']
