# Design: Sistema de Gestión de Asistencia — 6 Features

**Date:** 2026-07-25
**Project:** sistema-asistencia-taller
**Branch:** refactor/cleanup-structure

## Overview

UX overhaul of the attendance management system. The system works correctly but requires too many clicks and context switches for routine tasks. 6 features to improve visibility, reduce repetitive actions, and add missing capabilities.

## Features

### 1. Attendance Interface Improvement

**Problem:** After filtering by fecha/taller/horario, the result view is flat and hard to scan. No visual progress indicator.

**Solution:** Keep existing filters (fecha → taller → horario cascading). Improve the result display:
- Progress bar per horario showing X/Y attendance marked
- Color coding: green (complete), yellow (pending)
- Student count and status summary before the table
- Visual indicators for each student's status (colored dots, not just text)

**Note:** Red (holiday) color will be added when Feature 2 (holidays) ships. Feature 1 ships without it.

**Scope:** Frontend only. No backend changes needed — `por_horario` endpoint already returns all needed data.

### 2. Holiday System

**Problem:** No concept of holidays. If a class is cancelled, user must mark every student as "falta" individually.

**Solution:** New `Feriado` model + UI.

**New Model: `Feriado`**
```python
class Feriado(models.Model):
    ciclo = models.ForeignKey(Ciclo, on_delete=models.CASCADE)
    fecha = models.DateField()
    motivo = models.CharField(max_length=200)
    taller = models.ForeignKey(Taller, on_delete=models.CASCADE, null=True, blank=True)
    horario = models.ForeignKey(Horario, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Use UniqueConstraint instead of unique_together because
        # unique_together allows duplicate rows when columns are NULL.
        constraints = [
            models.UniqueConstraint(
                fields=['ciclo', 'fecha', 'taller', 'horario'],
                name='unique_feriado_per_scope',
                condition=Q(taller__isnull=False) | Q(horario__isnull=False),
            ),
            # For global holidays (taller=null, horario=null), allow only one per ciclo+fecha
            models.UniqueConstraint(
                fields=['ciclo', 'fecha'],
                name='unique_global_feriado',
                condition=Q(taller__isnull=True, horario__isnull=True),
            ),
        ]
```

**Scope levels:**
- Global (taller=null, horario=null): affects all talleres — one per ciclo+fecha
- Per taller (taller=X, horario=null): affects only that taller
- Per horario (taller=X, horario=Y): affects only that horario

**Backend changes:**
- New model + migration
- New ViewSet for CRUD — URL: `GET/POST/PUT/DELETE /api/ciclos/:ciclo_id/feriados/` (nested under ciclo, follows existing pattern for Horarios, Matriculas, etc.)
- New endpoint: `POST /api/ciclos/:ciclo_id/feriados/aplicar/` — auto-marks "falta" for pending attendances on that date
  - **Edge case behavior:** Skips attendances already marked (asistio/falta/falta_grave). Only marks students with no attendance record for that horario+fecha as "falta". Recovery attendances are skipped.
- Modify `por_horario` to check for feriados and return `es_feriado: true` when applicable

**Frontend changes:**
- New page: `pages/feriados/Feriados.tsx`
- New sub-components: `FeriadoFormModal`, `FeriadoList`
- Add to sidebar navigation
- Calendar indicator on attendance page for dates with feriados

### 3. Temporary Professor Replacement

**Problem:** When a professor substitutes for another, user must change the professor field one-by-one. No way to quickly override for a specific date.

**Solution:** Toggle button in the attendance filter bar.

**Flow:**
1. User selects horario + fecha → professor filter is LOCKED to the horario's professor
2. User clicks "Cambiar profesor" button → filter UNLOCKS
3. User selects substitute professor from dropdown
4. All attendance records for that date are saved with the substitute professor as `profesor`

**Backend changes:** None needed. `Asistencia.profesor` FK already supports any professor. The `create` endpoint accepts `profesor` in the body.

**Frontend changes:**
- Add toggle button next to locked professor filter
- When unlocked, show professor dropdown with all cycle professors
- Pass selected `profesor_id` to create/update calls instead of horario's default

### 4. Matrículas Redesign

**Problem:** 330+ matrículas in a flat table. Same student appears 5+ times. Can't see which are active vs recently concluded. "Ver" only shows schedule.

**Solution:** New grouped endpoint + card-based UI.

**Backend changes:**
- New endpoint: `GET /api/ciclos/:ciclo_id/matriculas/agrupadas/` — returns matrículas grouped by student
  ```json
  [
    {
      "alumno_id": 1,
      "alumno_nombre": "Trelles Anampa, Izan",
      "alumno_dni": "12345678",
      "matriculas": [
        {
          "id": 10,
          "taller": "Guitarra Eléctrica",
          "sesiones_consumidas": 5,
          "sesiones_contratadas": 8,
          "precio_total": "160.00",
          "estado": "activa",
          "recibo_estado": "pagado",
          "fecha_matricula": "2026-07-04T10:00:00Z"
        }
      ],
      "activas": 2,
      "concluidas": 3,
      "sin_procesar": 1
    }
  ]
  ```
  - Endpoint uses `annotate` + `values('alumno')` for backend aggregation (no frontend grouping of 330+ records)
  - Pagination: returns grouped results (page_size applies to student groups, not individual matrículas)
  - Supports same filters as existing matrículas endpoint (search, estado, taller, dia, hora)

- New endpoint: `GET /api/ciclos/:ciclo_id/alumnos/:alumno_id/detalle/` — full student detail with all matrículas + attendance summary
  - Note: uses `/detalle/` suffix to avoid collision with existing `GET /api/ciclos/:id/alumnos/:id/` (AlumnoViewSet retrieve)

- New endpoint: `GET /api/ciclos/:ciclo_id/matriculas/:matricula_id/detalle/` — full matrícula detail with receipt info + schedule + attendance history
  - Note: uses `/detalle/` suffix to avoid collision with existing `GET /api/ciclos/:id/matriculas/:id/` (MatriculaViewSet retrieve)

**Frontend changes:**
- Rewrite `Matriculas.tsx` to use grouped endpoint + card layout
- New sub-components: `MatriculaStudentCard`, `MatriculaRow`
- New page: `pages/matriculas/MatriculaDetalle.tsx` — full detail with "Ir a Recibo" button (when receipt exists)
- New page: `pages/alumnos/AlumnoDetalle.tsx` — full student detail with all matrículas + attendance history
- Add "Ir a Alumno" button in matrícula actions → navigates to `/alumnos/:id`
- Add "Ver detalle" button → navigates to `/matriculas/:id`
- "Recién concluidas" section at top (last 7 days) — this IS the notification feature, shown in the matrículas page

**Matrícula states (clarified):**
- `concluida` is auto-set by the serializer when `sesiones_disponibles <= 0` during attendance create/update
- Frontend detects conclusion by comparing `sesiones_consumidas` vs `sesiones_contratadas`
- Toast notification fires when `sesiones_consumidas` reaches `sesiones_contratadas` (front-end only, no backend change)

### 5. Notifications

**Problem:** No feedback when a matrícula concludes. Must manually check each student.

**Solution:** Toast notification + bell icon + notifications panel.

**Components:**
- Toast: appears automatically when matrícula reaches 0 sessions available (detected on attendance create/update response)
- Bell icon in header: shows unread count (stored in localStorage)
- Notifications panel: dropdown with recent notifications (matrícula concluded, por concluir warnings)

**Backend changes:** None needed. Frontend detects conclusion from attendance API response (sesiones_consumidas reaches sesiones_contratadas).

**Frontend changes:**
- Extend `ToastContext` for auto-toast on conclusion
- New component: `NotificationBell` in header
- New component: `NotificationPanel` dropdown
- New hook: `useNotifications()` — tracks conclusion events, persists to localStorage

### 6. Persistent Filters

**Problem:** Filters reset when navigating away and back. Can't share filtered views. Browser back button loses state.

**Solution:** Store filter state in URL query parameters.

**Implementation:**
- Introduce `useSearchParams` from react-router-dom (new pattern for this codebase)
- Replace `useState` for filters with URL params in affected pages
- Filters are always synced to URL: `?taller=3&estado=activa&dia=2&hora=14`
- Browser back/forward preserves filters
- URL is shareable
- "Clear filters" button resets all params

**Migration strategy:** Implement one page at a time (start with Matrículas since it's being rewritten). Other pages migrate incrementally.

**Frontend changes:**
- Modify filter bars to use URL params instead of local state
- Affects: Matrículas (immediate), Asistencias, Alumnos, Profesores, Horarios (incremental)
- Add "Limpiar filtros" button to each filter bar

## Architecture Decisions

### Data Model
- Only 1 new model: `Feriado` (with `UniqueConstraint` instead of `unique_together` to handle NULLs correctly)
- No `ProfesorSuplente` model — reuse existing `Asistencia.profesor` FK
- No `HorarioException` model — keep it simple with toggle in UI

### Backend
- New ViewSet for Feriados — nested under ciclo: `/api/ciclos/:ciclo_id/feriados/`
- New grouped endpoint: `/api/ciclos/:ciclo_id/matriculas/agrupadas/`
- New detail endpoints with `/detalle/` suffix to avoid URL collisions
- Modify `por_horario` to include feriado check
- All new endpoints follow existing patterns (DRF + StandardResultsSetPagination)

### Frontend
- New pages: Feriados, AlumnoDetalle, MatriculaDetalle
- Modified pages: Matriculas (group by student), Asistencias (improved result view)
- New components: NotificationBell, NotificationPanel, MatriculaStudentCard
- New hooks: useNotifications, useSearchParams integration
- Follow existing patterns: memo(), ResponsiveTable, PageHeader, inline styles + CSS
- Persistent filters: introduce useSearchParams incrementally, one page at a time

## Scope Boundaries

**In scope:**
- All 6 features as described
- Backend models, endpoints, migrations
- Frontend pages, components, hooks
- Navigation updates (sidebar)

**Out of scope:**
- Batch attendance operations (user said one-by-one is fine)
- Keyboard shortcuts
- Mobile-specific optimizations (existing responsive system is sufficient)
- Real-time notifications (WebSocket) — use polling or manual refresh

## Dependencies

1. `Feriado` model must be created before the holiday UI
2. Grouped matrículas endpoint must exist before the card-based UI
3. AlumnoDetalle page must exist before the "Ir a Alumno" button in matrículas
4. MatriculaDetalle page must exist before the "Ir a Recibo" button
5. Persistent filters are independent — can be implemented in parallel

## Risk

- **Feriado auto-mark logic:** Must skip already-marked attendances and recovery attendances. Only marks pending (no record) as "falta".
- **Matrículas grouping:** Backend aggregation via `values('alumno')` + `annotate` ensures O(1) per student group, not O(n) frontend grouping.
- **URL params:** Must handle type coercion (URL params are strings, filter values are integers). Use `parseInt()` with fallback.
- **useSearchParams migration:** New pattern for codebase. Start with Matrículas (being rewritten), migrate others incrementally to avoid breaking changes.
