# Design: Sistema de Notas Mejorado

## Context

The portal-docente has 3 note types (NotaClase, NotaDia, NotaAlumno) but they all require specific dependencies (taller, horario, alumno). Teachers need a way to create quick standalone notes without tying them to a specific class or student. The current UI also lacks pagination and proper organization.

## Goals

1. Enable standalone notes (no taller/hora dependency) with title + optional content
2. Separate note types visually using tabs (Generales | Clase | Alumno)
3. Add server-side pagination (20 per page) to all note endpoints
4. Group notes by day, most recent first
5. Keep existing NotaClase and NotaAlumno functionality intact

## Approach: Modify NotaDia

Modify the existing `NotaDia` model instead of creating a new one. Add `titulo` field, remove `unique_together` constraint, and rename related_name.

---

## Backend Changes

### Model: `NotaDia` (core/models/nota_dia.py)

**Fields (after migration):**
- `ciclo` — FK to Ciclo (related_name=`notas_generales`)
- `profesor` — FK to Profesor (related_name=`notas_generales`)
- `fecha` — DateField (default=today)
- `titulo` — CharField(200) ← NEW, required
- `contenido` — TextField (blank=True) ← now truly optional
- `created_at` / `updated_at` — auto timestamps

**Constraints:**
- Remove: `unique_together = [('ciclo', 'profesor', 'fecha')]`
- This allows multiple general notes per day

**Migration steps:**
1. Add `titulo` field (default="Nota del {fecha}")
2. Remove `unique_together` constraint
3. Update `related_name` from `notas_dia` to `notas_generales`
4. Data migration: populate titulo for existing records

### Serializer: `NotaDiaSerializer` (core/serializers/portal_docente/serializers.py)

**Updated fields:**
- `id` (read-only)
- `titulo` (required, max 200 chars)
- `contenido` (optional, blank allowed)
- `fecha` (auto, not writable on create)
- `created_at` / `updated_at` (read-only)

### Views: `ProfesorNotasDiaView` (core/views/portal_docente/notas_dia_view.py)

**Updated behavior:**
- GET: paginate using `StandardResultsSetPagination` (page_size=20, max=200)
- POST: require `titulo`, auto-set `fecha=today`, auto-set `profesor` and `ciclo` from JWT
- Response format: `{ "count": N, "next": "...", "previous": null, "results": [...] }`

### Views: `ProfesorNotasView` (core/views/portal_docente/notas_view.py)

**Updated behavior:**
- GET: paginate using `StandardResultsSetPagination`
- Response format: same paginated shape

### Views: `ProfesorNotasAlumnoView` (core/views/portal_docente/notas_alumno_view.py)

**Updated behavior:**
- GET: paginate using `StandardResultsSetPagination`
- Response format: same paginated shape

---

## Frontend Changes

### Types: `types/index.ts`

**New/updated interfaces:**
```typescript
// Paginated response wrapper
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// NotaDia now includes titulo
interface NotaDia {
  id: number;
  titulo: string;
  contenido: string;
  fecha: string;
  created_at: string;
  updated_at?: string;
}

// NotaClase — unchanged fields
interface NotaClase {
  id: number;
  horario: number;
  horario_info?: Horario;
  taller_nombre?: string;
  fecha: string;
  contenido: string;
  created_at: string;
  updated_at?: string;
}

// NotaAlumno — unchanged fields
interface NotaAlumno {
  id: number;
  horario: number;
  alumno: number;
  alumno_nombre?: string;
  fecha: string;
  contenido: string;
  created_at: string;
  updated_at?: string;
}
```

### API: `api/portalDocente.ts`

**Updated functions:**
- `getNotasDia(cicloId, params?)` → returns `PaginatedResponse<NotaDia>`
  - Params: `?page=1&page_size=20&fecha=YYYY-MM-DD`
- `createNotaDia(cicloId, data)` → POST `{ titulo, contenido? }`
- `getNotas(cicloId, params?)` → returns `PaginatedResponse<NotaClase>`
  - Params: `?page=1&page_size=20&horario_id=X&fecha=YYYY-MM-DD`
- `getNotasAlumno(cicloId, params?)` → returns `PaginatedResponse<NotaAlumno>`
  - Params: `?page=1&page_size=20&horario_id=X&alumno_id=X&fecha=YYYY-MM-DD`

### Hooks

**New: `useNotasDia` hook** (replaces existing)
- Fetches paginated NotaDia for active ciclo
- Returns: `{ notas, count, page, setPage, loading, error, refetch }`

**New: `useNotasClase` hook**
- Fetches paginated NotaClase for active ciclo
- Returns: same shape as above

**New: `useNotasAlumno` hook**
- Fetches paginated NotaAlumno for active ciclo
- Returns: same shape as above

### Page: `NotesPage.tsx`

**Layout:**
```
┌──────────────────────────────────────────┐
│ Notas                          [+ Nueva] │
├──────────────────────────────────────────┤
│ [Generales] [Clase] [Alumno]  ← tabs    │
├──────────────────────────────────────────┤
│ Filtrar por fecha: [________] [▾]       │
├──────────────────────────────────────────┤
│                                          │
│ NotaCard (titulo + contenido + fecha)    │
│ NotaCard ...                             │
│ NotaCard ...                             │
│                                          │
├──────────────────────────────────────────┤
│ ← 1 2 3 ... 10 →                        │
└──────────────────────────────────────────┘
```

**Tab behavior:**
- Each tab loads its own data independently (lazy: only fetch when tab is selected)
- Active tab persists during session (not across page navigations)
- "Generales" tab is default

**Create flow (General tab):**
- Click "+ Nueva" → inline form appears
- Fields: titulo (required), contenido (optional textarea)
- Submit → POST to /notas-dia/ → prepend to list

**Create flow (Clase tab):**
- Click "+ Nueva" → inline form with taller → horario cascade + contenido
- Submit → POST to /notas/

**Create flow (Alumno tab):**
- Click "+ Nueva" → inline form with taller → horario → alumno cascade + contenido
- Submit → POST to /notas-alumno/

**Pagination:**
- Server-side, 20 per page
- Page selector at bottom of list
- Reset to page 1 when switching tabs or changing filters

**Grouping:**
- Notes grouped by date under collapsible day headers
- Most recent day first
- Day header shows: "Lunes 28 de julio" format

### Components

**`NotaCard`** (new):
- Displays: titulo (bold), contenido (if exists, truncated), fecha
- Actions: editar (pencil), eliminar (trash with confirm)
- Unified for all 3 types

**`NotaDayGroup`** (new):
- Groups cards by day under a styled header
- Collapsible (default expanded)

**`Pagination`** (new):
- Simple page numbers: ← 1 2 3 ... 10 →
- Disabled state for prev/next at boundaries

---

## API Response Examples

### GET /api/portal-docente/ciclos/1/notas-dia/?page=1&page_size=20

```json
{
  "count": 45,
  "next": "http://...?page=2",
  "previous": null,
  "results": [
    {
      "id": 12,
      "titulo": "Nota sobre ritmo",
      "contenido": "Los alumnos mejoraron en compás",
      "fecha": "2026-07-31",
      "created_at": "2026-07-31T10:30:00Z",
      "updated_at": "2026-07-31T10:30:00Z"
    }
  ]
}
```

### POST /api/portal-docente/ciclos/1/notas-dia/

Request: `{ "titulo": "Reunión pendiente", "contenido": "Hablar con director" }`
Response: 201 with created object (fecha auto-set to today)

---

## Migration Plan

1. Add `titulo` field to NotaDia with default
2. Run data migration: `NotaDia.objects.all().update(titulo=F('fecha'))` then prepend "Nota del "
3. Remove `unique_together` constraint
4. Update `related_name` to `notas_generales`
5. Update serializers and views
6. Deploy backend first (backward compatible — old frontend still works)
7. Deploy frontend with new tabs and pagination

---

## Non-Goals

- Merging all note types into one (user explicitly wants them separate)
- Rich text editing (plain textarea is sufficient)
- Note categories/tags (can add later if needed)
- Bulk operations on notes
