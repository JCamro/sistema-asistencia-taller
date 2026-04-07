# AGENTS.md — Panel de Asistencia (Taller de Música Elguera)

## Overview

Administrative web app for managing educational-artistic workshops.
- **Backend**: Django 6.0.3 + DRF 3.17.1 + SimpleJWT 5.5.1 (PostgreSQL in production)
- **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Zustand
- **Language**: Spanish (all user-facing text)
- **Timezone**: `America/Lima`
- **Locale**: `es-pe`

---

## Architecture

```
sistema-asistencia-taller/
├── config/                          # Django project config
│   ├── settings.py                  # Settings (JWT, CORS, whitenoise, PostgreSQL)
│   ├── urls.py                      # Root URL: admin/, setup/, api/, api/docs/
│   └── wsgi.py / asgi.py            # WSGI/ASGI entry points
├── core/                            # Main Django app
│   ├── models/                      # 17 models (one file per entity)
│   │   ├── ciclo.py                 # Academic cycles
│   │   ├── alumno.py                # Students
│   │   ├── profesor.py              # Teachers
│   │   ├── taller.py                # Workshops
│   │   ├── horario.py               # Schedules
│   │   ├── matricula.py             # Enrollments
│   │   ├── matricula_horario.py     # Enrollment ↔ Schedule junction
│   │   ├── asistencia.py             # Attendance records (indexed: fecha, estado, horario+fecha)
│   │   ├── recibo.py                # Receipts (multi-student capable)
│   │   ├── recibo_matricula.py      # Receipt ↔ Enrollment junction
│   │   ├── precio_paquete.py       # Package pricing + promo detection
│   │   ├── pago_profesor.py         # Teacher payment summaries
│   │   ├── pago_profesor_detalle.py # Teacher payment per-class detail
│   │   ├── configuracion.py         # App config (active cycle, dynamic payment config)
│   │   ├── egreso.py                # Expenses
│   │   └── historial_traspaso.py    # Student transfer history
│   ├── serializers/                 # DRF serializers (list + detail per entity)
│   ├── views/                       # ViewSets + function-based views
│   │   ├── ciclo_view.py           # Pagination (StandardResultsSetPagination)
│   │   ├── alumno_view.py           # Pagination + select_related(ciclo)
│   │   ├── profesor_view.py          # Pagination + select_related(ciclo)
│   │   ├── taller_view.py           # Pagination + select_related(ciclo)
│   │   ├── horario_view.py           # Pagination + prefetch(matricula→alumno) + annotate(ocupacion)
│   │   ├── matricula_view.py         # OuterRef inline fix + estado_calculado annotation
│   │   ├── asistencia_view.py        # Pagination + select_related(matricula→alumno/taller)
│   │   ├── recibo_view.py           # select_related + prefetch (no pagination)
│   │   ├── pago_profesor_view.py    # Pagination + select_related
│   │   ├── precio_paquete_view.py   # select_related (no pagination)
│   │   ├── egreso_view.py           # select_related (no pagination)
│   │   ├── dashboard_view.py        # KPIs via DB aggregations (Exists inline)
│   │   ├── configuracion_view.py   # Singleton config
│   │   ├── pagination.py            # StandardResultsSetPagination (page_size=20, max=100)
│   │   └── setup_view.py            # Initial setup endpoint
│   ├── services/                    # Business logic layer
│   │   ├── pago_profesor_service.py # Teacher payment calculation engine
│   │   ├── matricula_service.py     # Enrollment + pricing logic
│   │   └── recibo_service.py        # Receipt generation + discounts
│   ├── management/commands/
│   │   └── seed_precios.py          # Seed default package prices (idempotente)
│   ├── constants.py                 # Payment constants (BASE_PAGO=17, TOPE_MAXIMO=35)
│   ├── urls.py                      # API routing (DRF DefaultRouter + manual paths)
│   └── tests/                       # pytest-django tests (105 passing)
│       ├── test_pago_profesor_service.py
│       ├── test_matricula_service.py
│       ├── test_recibo_service.py
│       └── test_constants.py
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── axios.ts             # Axios instance (auto token refresh)
│       │   └── endpoints.ts        # All API endpoints + TypeScript interfaces
│       ├── components/
│       │   └── ui/                 # Reusable UI components
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       ├── Card.tsx
│       │       ├── Loading.tsx
│       │       ├── Toast.tsx
│       │       ├── ConfirmModal.tsx
│       │       ├── TraspasoModal.tsx
│       │       ├── DataCard.tsx            # Mobile card component (ResponsiveTable sub-component)
│       │       └── ResponsiveTable.tsx      # Table → cards on mobile (≤768px)
│       ├── hooks/
│       │   └── useWindowWidth.ts          # Hook: window width for JS-side breakpoint detection
│       ├── contexts/
│       │   ├── CicloContext.tsx      # Active cycle state management
│       │   └── ToastContext.tsx      # Toast notification system
│       ├── pages/                   # 14 page components (all wrapped in memo())
│       │   ├── Login.tsx            # Login (inline in App.tsx)
│       │   ├── Dashboard.tsx        # KPIs + CalculadoraPrecios inline
│       │   ├── Alumnos.tsx          # Student CRUD + ResponsiveTable
│       │   ├── Profesores.tsx       # Teacher CRUD + ResponsiveTable
│       │   ├── Talleres.tsx        # Workshop CRUD
│       │   ├── TallerDetalle.tsx    # Workshop detail view
│       │   ├── Horarios.tsx         # Schedule management (calendar grid)
│       │   ├── Matriculas.tsx       # Enrollment management + ResponsiveTable
│       │   ├── Asistencias.tsx      # Attendance tracking
│       │   ├── Recibos.tsx          # Receipt management + ResponsiveTable
│       │   ├── Egresos.tsx          # Expense management + ResponsiveTable
│       │   ├── Finanzas.tsx        # Financial summary with tabs
│       │   ├── ConfiguracionPrecios.tsx  # Package price configuration
│       │   ├── CalculadoraPrecios.tsx    # Price calculator
│       │   └── PagosProfesores.tsx       # Teacher payment calculator + ResponsiveTable
│       ├── stores/
│       │   └── authStore.ts         # Zustand auth store
│       ├── App.tsx                  # Router + Sidebar (hamburger on mobile) + Login
│       ├── index.css                 # Responsive CSS (breakpoints, utility classes)
│       └── main.tsx                 # Vite entry point
├── start.sh                         # Production start script (migrate + collectstatic + gunicorn)
├── Procfile                         # Railway: web: bash start.sh
├── db.sqlite3                       # SQLite database (dev only)
├── manage.py                        # Django management
├── requirements.txt                 # Python dependencies
├── pytest.ini                       # Test configuration
└── .gitignore                       # Excludes: db.sqlite3, __pycache__, .coverage, .env
```

---

## API — Router Architecture

**Pattern**: DRF `DefaultRouter` for CRUD resources + manual `path()` for custom actions and nested endpoints.

```
core/urls.py — URL structure:

  Custom actions (function-based views)
    POST /api/auth/login/                    — TokenObtainPairView
    POST /api/auth/refresh/                 — TokenRefreshView
    POST /api/auth/logout/                  — TokenBlacklistView
    PATCH /api/config/                      — Set active cycle
    POST /api/pagos-profesores/calcular-periodo/
    GET  /api/pagos-profesores/detalle-clase/?horario_id=X&fecha=YYYY-MM-DD
    GET  /api/ciclos/<id>/resumen/
    GET  /api/ciclos/<id>/resumen-mensual/
    GET  /api/ciclos/<id>/dashboard/
    GET  /api/ciclos/<id>/alumnos/
    GET  /api/ciclos/<id>/talleres/
    GET  /api/ciclos/<id>/profesores/
    GET  /api/ciclos/<id>/horarios/
    GET  /api/ciclos/<id>/matriculas/
    GET  /api/ciclos/<id>/asistencias/
    GET  /api/ciclos/<id>/recibos/
    GET  /api/ciclos/<id>/precios/
    GET  /api/ciclos/<id>/egresos/

  Router (ViewSet CRUD — automatic routes)
    /api/ciclos/                    — CicloViewSet
    /api/talleres/                  — TallerViewSet
    /api/profesores/                — ProfesorViewSet
    /api/alumnos/                   — AlumnoViewSet
    /api/horarios/                  — HorarioViewSet
    /api/matriculas/                — MatriculaViewSet
    /api/matriculas-horarios/       — MatriculaHorarioViewSet
    /api/asistencias/               — AsistenciaViewSet
    /api/recibos/                   — ReciboViewSet
    /api/pagos-profesores/          — PagoProfesorViewSet
    /api/precios/                   — PrecioPaqueteViewSet
    /api/egresos/                   — EgresoViewSet
```

### Paginated vs Non-Paginated ViewSets

Paginated (page_size=20, max=100): `Alumno, Profesor, Taller, Horario, Matricula, Asistencia, Ciclo, PagoProfesor`

Non-paginated (frontend expects direct array): `Recibo, PrecioPaquete, Egreso`

---

## Responsive Design

### Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | `< 480px` | Cards, single column |
| Tablet | `480px – 768px` | Cards, 1-2 columns |
| Desktop | `> 768px` | Full table layout |

### CSS System (`frontend/src/index.css`)
```css
:root {
  --breakpoint-sm: 480px;
  --breakpoint-md: 768px;
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
}

/* Utility classes */
.hide-mobile    { display: none; }          /* shown ≥768px */
.hide-desktop   { display: none; }           /* shown <768px */
.stack-on-mobile { flex-direction: column; }  /* on <768px */
.touch-target   { min-height: 44px; }       /* all interactive elements */
```

### Components
- **`ResponsiveTable<T>`** — Table on desktop, card grid on mobile. Props: `columns`, `data`, `keyField`, `actions`. Mobile threshold: `≤768px` via `useWindowWidth`.
- **`DataCard`** — Sub-component for mobile card rows. Props: `title?`, `children`, `actions?`, `onClick?`, `variant`.
- **`useWindowWidth()`** — Hook returning `window.innerWidth`, updates on resize.

---

## Commands

### Backend (from project root)
```bash
python manage.py runserver              # Dev server :8000
python manage.py makemigrations         # Create migrations
python manage.py migrate               # Apply migrations
python manage.py shell                 # Django shell
python manage.py seed_precios          # Seed default prices (idempotent)
python manage.py createsuperuser       # Create admin user
pytest                                  # Run all tests (105 passing)
pytest --cov                            # With coverage
```

### Frontend (from `frontend/`)
```bash
npm run dev       # Dev server :5173 (proxy → :8000)
npm run build     # Production build (tsc -b && vite build)
npm run lint      # ESLint check
npm run preview   # Preview production build
```

### Production Start (`start.sh`)
```bash
#!/bin/bash
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear
gunicorn config.asgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4
```

---

## Frontend Routes

| Path | Component | Access |
|------|-----------|--------|
| `/login` | Login (inline in App.tsx) | Public |
| `/` | SeleccionCiclos | Protected (cycle selection) |
| `/dashboard` | Dashboard | Protected + Sidebar |
| `/alumnos` | Alumnos | Protected + Sidebar |
| `/profesores` | Profesores | Protected + Sidebar |
| `/talleres` | Talleres | Protected + Sidebar |
| `/talleres/:tallerId` | TallerDetalle | Protected + Sidebar |
| `/horarios` | Horarios | Protected + Sidebar |
| `/matriculas` | Matriculas | Protected + Sidebar |
| `/asistencias` | Asistencias | Protected + Sidebar |
| `/recibos` | Recibos | Protected + Sidebar |
| `/egresos` | Egresos | Protected + Sidebar |
| `/finanzas` | Finanzas | Protected + Sidebar |
| `/configuracion-precios` | ConfiguracionPrecios | Protected + Sidebar |
| `/pagos-profesores` | PagosProfesores | Protected + Sidebar |

**Navigation Flow**: Login → `/` (select cycle) → `/dashboard` → sidebar navigation

---

## Data Models

### Core Entities
- **Ciclo**: `nombre`, `tipo` (anual/verano/otro), `fecha_inicio`, `fecha_fin`, `activo`
- **Alumno**: `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `fecha_nacimiento`, `activo`
- **Profesor**: `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `fecha_nacimiento`, `activo`
- **Taller**: `ciclo` (FK), `nombre`, `tipo` (instrumento/taller), `descripcion`, `activo`
- **Horario**: `ciclo`, `taller`, `profesor`, `dia_semana`, `hora_inicio/fin`, `cupo_maximo`, `tipo_pago` (tarifa fija/dinámico)

### Enrollment & Attendance
- **Matricula**: `alumno`, `taller`, `sesiones_contratadas`, `precio_total`, `precio_por_sesion`, `concluida`, `metodo_pago`
- **MatriculaHorario**: `matricula`, `horario` (junction: which schedule a student attends)
- **Asistencia**: `matricula`, `horario`, `fecha`, `hora`, `estado` (presente/ausente/tardanza)
  - **Indexes**: `db_index=True` on `fecha` and `estado`; composite index on `(horario, fecha)`

### Financial
- **Recibo**: `numero`, `alumno` (nullable), `ciclo`, `monto_bruto`, `monto_total`, `monto_pagado`, `descuento`, `estado`, `paquete_aplicado`
- **ReciboMatricula**: `recibo`, `matricula` (junction: multi-student receipts)
- **PrecioPaquete**: `ciclo`, `tipo_taller`, `tipo_paquete`, `cantidad_clases`, `cantidad_clases_secundaria`, `precio_total`, `precio_por_sesion`, `activo`
- **PagoProfesor**: `profesor`, `ciclo`, `horas_calculadas`, `monto_final`, `fecha_inicio`, `fecha_fin`, `total_alumnos_asistencias`, `ganancia_taller`
- **PagoProfesorDetalle**: `pago_profesor`, `horario`, `fecha`, `num_alumnos`, `valor_generado`, `monto_base`, `monto_adicional`, `monto_profesor`, `ganancia_taller`
- **Egreso**: `ciclo`, `tipo`, `monto`, `descripcion`, `categoria`, `beneficiario`, `profesor` (FK nullable), `fecha`, `estado`

### System
- **Configuracion**: `clave`, `valor` (stores active cycle, dynamic payment config: `base_pago`, `tope_maximo`, `porcentaje_adicional`)
- **HistorialTraspaso**: `alumno`, `ciclo_origen`, `ciclo_destino`, `fecha`

---

## Pricing System

### Package Types (`PrecioPaquete`)

| `tipo_paquete` | Description | `cantidad_clases_secundaria` |
|----------------|-------------|------------------------------|
| `individual` | Base price per class count | `null` |
| `combo_musical` | 2+ instruments discount | Set (e.g., 12+8) |
| `mixto` | Instrument + Taller discount | Set (e.g., 12+8) |
| `intensivo` | 20-class intensive package | `null` |

### Unique Constraint
`(ciclo, tipo_taller, tipo_paquete, cantidad_clases, cantidad_clases_secundaria)` — allows asymmetric combos (12+12 and 12+8 as separate records).

### Price Calculator Logic (`calcular_precio_recomendado`)
1. Calculate brute price per item using `get_precio_individual(tipo_taller, cantidad_clases, ciclo_id)`
2. Detect promo: combo_musical (2+ instruments) → mixto (1 instrument + 1 taller) → intensivo (20 classes)
3. Apply discount if promo matches
4. Fallback: `ciclo_id=None` (global prices) if no cycle-specific price found

---

## Pagos Profesores — Payment Model

### Formula (per class)
```
0 alumnos   → S/. 0.00
1 alumno   → S/. 17.00 (BASE_PAGO) fijo
2+ alumnos → S/. 17.00 + 50% (PORCENTAJE_ADICIONAL) × valor sesión cada alumno adicional
Tope       → Máx S/. 35.00 (TOPE_MAXIMO) por clase
```

### Dynamic Configuration
Configurable via `Configuracion` table: `base_pago`, `tope_maximo`, `porcentaje_adicional`. Falls back to `core/constants.py`.

---

## Authentication & Security

- **JWT**: Access token 8h, Refresh token 7d, rotation with blacklisting
- **Auth flow**: Login → store tokens in localStorage → axios interceptor adds Bearer → auto-refresh on 401
- **Protected routes**: `ProtectedRoute` checks localStorage for `access_token` → redirects to `/login`
- **Cycle selection**: Required before accessing protected pages (stored in `Configuracion` DB)
- **localStorage**: Always wrap in try-catch (fails in private/incognito mode)

---

## Code Style

### Backend (Django/Python)
- **Naming**: `snake_case` for all Python identifiers
- **Validation**: In serializers only, never in views
- **Queries**: Use `select_related` / `prefetch_related` — **every** ViewSet has optimized queries
- **N+1 prevention**: `Exists` annotations defined **inline** inside `annotate()` calls, never stored as separate variables referencing `OuterRef` from outside the filter scope
- **Models**: One model per file in `core/models/`
- **Views**: One ViewSet per file in `core/views/`
- **Services**: Business logic in `core/services/`, views stay thin
- **Pagination**: `StandardResultsSetPagination` on most ViewSets; omit pagination where frontend expects direct arrays

### Frontend (React/TypeScript)
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components/interfaces
- **Files**: `PascalCase.tsx` for pages, `camelCase.ts` for utilities
- **HTTP**: axios instance from `api/axios.ts` (handles token refresh automatically)
- **State**: Zustand for auth, React Context for cycle management and toasts
- **Styles**: Inline styles + CSS utility classes — no Tailwind
- **Performance**: Wrap **every** page component with `memo()`; generic components (`ResponsiveTable`, `DataCard`) are `memo()` wrapped
- **Responsive**: Use `useWindowWidth()` hook + `ResponsiveTable` for table-to-cards pattern; `grid-template-columns: repeat(auto-fit, minmax(Xpx, 1fr))` for card grids; form grids: `repeat(auto-fit, minmax(200px, 1fr))`

### TypeScript Config
- Target: ES2023, strict mode enabled
- `noUnusedLocals: true`, `noUnusedParameters: true`
- JSX: react-jsx transform
- Module: ESNext with bundler resolution

---

## Key Rules

1. **Cycle Selection Required**: Login redirects to `/` (cycle selection). Must select a cycle before accessing other pages.
2. **Active Cycle**: Stored in `Configuracion` DB table, NOT localStorage. Use `PATCH /api/config/` to set.
3. **All entities have FK to Ciclo**: Alumno, Profesor, Taller, Horario all require a ciclo.
4. **Receipts can be multi-student**: `alumno` field is nullable; use `ReciboMatricula` junction table.
5. **Matricula states**: Active by default, can be marked `concluida`.
6. **JWT Tokens**: Access (8h), Refresh (7d) with blacklisting on rotation.
7. **localStorage**: Always wrap in try-catch.
8. **Language**: All user-facing text in Spanish.
9. **Horarios filter required**: Taller/instrumento filter is mandatory — no "show all" option.
10. **PrecioPaquete combos**: Use `cantidad_clases_secundaria` for asymmetric combos (12+8 vs 12+12).
11. **N+1 queries**: Always use `select_related`/`prefetch_related`; annotate with `Exists` inline (never store `Exists(OuterRef(...))` outside the annotate call).
12. **Responsive components**: Use `ResponsiveTable` for all list views with tables. Use `useWindowWidth()` for custom responsive logic.
13. **Touch targets**: Minimum 44px height via `.touch-target` CSS class for all interactive elements on mobile.

---

## Contexts & Hooks

### CicloContext
```typescript
const { cicloActual, ciclos, setCicloActual, seleccionarCiclo, recargar, isLoading } = useCiclo();
```

### ToastContext
```typescript
const toast = useToast();
toast.showToast('Mensaje', 'success' | 'error' | 'warning');
```

### useWindowWidth
```typescript
const width = useWindowWidth(); // number — window.innerWidth, updates on resize
const isMobile = width <= 768;
```

---

## Deployment

### Railway (Backend)
1. Connect repo → select `deployv4` branch
2. Environment variables:
   - `DATABASE_URL` — PostgreSQL (auto-provided by Railway)
   - `SECRET_KEY` — generate a secure random string
   - `DEBUG=false`
   - `ALLOWED_HOSTS` — your Railway subdomain (e.g., `tu-app.railway.app`)
   - `CORS_ALLOWED_ORIGINS` — frontend Vercel URL
3. Start command: `bash start.sh`
4. Seed prices after first deploy: `python manage.py seed_precios`

### Vercel (Frontend)
1. Import repo → select frontend directory
2. Framework: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variable: `VITE_API_URL=https://your-railway-url/api`

### start.sh (Production Start)
```bash
#!/bin/bash
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear
gunicorn config.asgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 4
```

### Production Stack
- **Database**: PostgreSQL (Railway) — SQLite only in dev
- **WSGI**: Gunicorn with 2 workers, 4 threads
- **Static files**: whitenoise (CompressedManifestStaticFilesStorage)
- **Secret key**: Environment variable (never hardcoded in production)
- **CORS**: Restricted to known origins (`CORS_ALLOW_ALL_ORIGINS = DEBUG`)
