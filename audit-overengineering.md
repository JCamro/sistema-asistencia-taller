# Ponytail Audit — sistema-asistencia-taller

> Auditoría de over-engineering. No incluye bugs, seguridad ni performance.
> Fecha: 2026-07-06
> **CORREGIDO**: El repo `portal-docente` (standalone frontend) consume los endpoints `/api/portal-docente/*`.
> Nada de eso es código muerto.

---

## Dead code chico

| Tag | Qué cortar | Path |
|-----|-----------|------|
| delete | SetupBlockedView + SetupSuccessView — 19 líneas, no wired en urls.py | `core/views/setup_view.py:161-182` |
| delete | ConfiguracionViewSet — 9 líneas, deprecated alias no registrado | `core/views/configuracion_view.py:38-46` |
| delete | HistorialTraspasoSerializer — 18 líneas, ningún view lo usa | `core/serializers/traspaso.py:16-35` |
| delete | format_nombre — 4 líneas, solo se llama a sí mismo | `core/serializer_helpers.py:34-36` |
| delete | getApiUrl — 1 línea alias, sin callers | `frontend/src/utils/api.ts:15` |
| delete | getPagosProfesores + getResumenCiclo — 2 exports muertos | `frontend/src/api/endpoints.ts:370,375` |
| delete | PORCENTAJE_LOCAL = 40 — nunca leído | `config/settings.py:27` |
| delete | throttle rates 'student_login' / 'docente_login' — solo usados por portal auth | `config/settings.py:162-163` |
| delete | core/models.py + core/views.py — stubs vacíos de startapp | `core/models.py`, `core/views.py` |
| delete | Login.tsx — 115 líneas, nunca importado | `frontend/src/pages/Login.tsx` |
| delete | usePagination hook — 80 líneas, nunca importado | `frontend/src/hooks/usePagination.ts` |
| delete | Card.tsx — 27 líneas, nunca importado | `frontend/src/components/ui/Card.tsx` |
| delete | HorasTrabajadas.tsx — 2 líneas, re-export de HorasProfesores | `frontend/src/pages/HorasTrabajadas.tsx` |

## Live code over-engineered (shrink / yagni)

| Tag | Qué cortar | Reemplazo | Path |
|-----|-----------|-----------|------|
| shrink | get_alumno_nombre duplicado verbatim en ReciboSerializer + ReciboListSerializer | unificar en serializer_helpers | `core/serializers/recibo.py:48-55,89-96` |
| shrink | _distribute_amounts + distribución en update_recibo, 80 líneas near-duplicadas | extraer split/quantize una vez | `core/services/recibo_service.py:151-235, 95-145` |
| shrink | logger.debug con .count() (fuerza query) en cada list de egresos | dejar 1 línea para filtro ciclo_id | `core/views/egreso_view.py:33-41` |
| shrink | imports de Exists, OuterRef etc. dentro de función en matricula_view | mover al tope del módulo | `core/views/matricula_view.py:28-30` |
| yagni | historial_traspaso — tabla se escribe sin API para leerla | Serializers muertos | `core/models/historial_traspaso.py` |
| yagni | createsuperuser override — solo si Railway lo necesita | keep o delete según deploy | `core/management/commands/createsuperuser.py` |

## Not dead (corrección)

Lo siguiente **NO es código muerto** — el frontend standalone `portal-docente` consume estos endpoints:

| Backend | Usado por portal-docente |
|---------|-------------------------|
| `core/views/portal_docente/` (13 files) | ✅ auth, ciclos, horarios, alumnos, asistencias, horas-trabajadas, dashboard, notas, notas-alumno, notas-dia, pagos |
| `core/serializers/portal_docente/` | ✅ consumed by views above |
| `core/models/nota_clase.py`, `nota_dia.py`, `nota_alumno.py` | ✅ CRUD endpoints consumidos |
| `core/authentication.py` (ProfesorJWTAuthentication, get_profesor_for_ciclo) | ✅ JWT auth para portal docente |
| `core/views/portal/` (student portal) | ⚠️ REVISAR si portal-estudiante existe |

---

## Summary

```
net: ~-400 líneas (dead chico), -0 deps.
El 95% del backend "muerto" en realidad lo consume el frontend standalone portal-docente.
```
