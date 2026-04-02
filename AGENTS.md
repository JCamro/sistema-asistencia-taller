# AGENTS.md - Panel de Asistencia

## Overview

Administrative web app for managing educational-artistic workshops ("Taller de Música Elguera").
- **Backend**: Django 6.0 + DRF + SimpleJWT (SQLite3)
- **Frontend**: React 19 + Vite 8 + TypeScript 5.9 + Zustand
- **Language**: Spanish (all user-facing text)
- **Timezone**: `America/Lima`
- **Locale**: `es-pe`

---

## Architecture

```
sistema-asistencia-taller/
├── config/                          # Django project config
│   ├── settings.py                  # Settings (SQLite3, JWT, CORS)
│   ├── urls.py                      # Root URL config
│   ├── wsgi.py / asgi.py            # WSGI/ASGI entry points
│   └── __init__.py
├── core/                            # Main Django app
│   ├── models/                      # 15 models (one file per entity)
│   │   ├── ciclo.py                 # Academic cycles
│   │   ├── alumno.py                # Students
│   │   ├── profesor.py              # Teachers
│   │   ├── taller.py                # Workshops
│   │   ├── horario.py               # Schedules
│   │   ├── matricula.py             # Enrollments
│   │   ├── matricula_horario.py     # Enrollment ↔ Schedule junction
│   │   ├── asistencia.py            # Attendance records
│   │   ├── recibo.py                # Receipts (multi-student capable)
│   │   ├── recibo_matricula.py      # Receipt ↔ Enrollment junction
│   │   ├── precio_paquete.py        # Package pricing + promo detection
│   │   ├── pago_profesor.py         # Teacher payment summaries
│   │   ├── pago_profesor_detalle.py # Teacher payment per-class detail
│   │   ├── configuracion.py         # App config (active cycle, etc.)
│   │   └── historial_traspaso.py    # Student transfer history
│   ├── serializers/                 # DRF serializers (list + detail per entity)
│   ├── views/                       # ViewSets (one file per entity)
│   ├── services/                    # Business logic layer
│   │   ├── pago_profesor_service.py # Teacher payment calculation engine
│   │   ├── matricula_service.py     # Enrollment + pricing logic
│   │   └── recibo_service.py        # Receipt generation + discounts
│   ├── management/commands/
│   │   └── seed_precios.py          # Seed default package prices
│   ├── tests/                       # pytest-django tests
│   │   ├── test_pago_profesor_service.py
│   │   ├── test_matricula_service.py
│   │   ├── test_recibo_service.py
│   │   └── test_constants.py
│   ├── constants.py                 # Payment calculation constants
│   └── urls.py                      # API routing (router + manual paths)
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── axios.ts             # Axios instance (auto token refresh)
│       │   └── endpoints.ts         # All API endpoints + TypeScript interfaces
│       ├── components/
│       │   └── ui/                  # Reusable UI components
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       ├── Card.tsx
│       │       ├── Loading.tsx
│       │       ├── Toast.tsx
│       │       ├── ConfirmModal.tsx
│       │       └── TraspasoModal.tsx
│       ├── contexts/
│       │   ├── CicloContext.tsx      # Active cycle state management
│       │   └── ToastContext.tsx      # Toast notification system
│       ├── pages/                   # 14 page components
│       │   ├── Login.tsx            # Login page (alternate version)
│       │   ├── Dashboard.tsx        # KPIs + charts
│       │   ├── Alumnos.tsx          # Student CRUD
│       │   ├── Profesores.tsx       # Teacher CRUD
│       │   ├── Talleres.tsx         # Workshop CRUD
│       │   ├── TallerDetalle.tsx    # Workshop detail view
│       │   ├── Horarios.tsx         # Schedule management
│       │   ├── Matriculas.tsx       # Enrollment management
│       │   ├── Asistencias.tsx      # Attendance tracking
│       │   ├── Recibos.tsx          # Receipt management
│       │   ├── ConfiguracionPrecios.tsx  # Package price configuration
│       │   ├── CalculadoraPrecios.tsx    # Price calculator
│       │   └── PagosProfesores.tsx       # Teacher payment calculator
│       ├── stores/
│       │   └── authStore.ts         # Zustand auth store
│       ├── App.tsx                  # Router + Sidebar + Login (inline)
│       └── main.tsx                 # Vite entry point
├── db.sqlite3                       # SQLite database
├── manage.py                        # Django management
├── requirements.txt                 # Python dependencies
└── pytest.ini                       # Test configuration
```

---

## Commands

### Backend (from project root)
```bash
python manage.py runserver              # Start server :8000
python manage.py makemigrations         # Create migrations
python manage.py migrate               # Apply migrations
python manage.py shell                 # Django shell
python manage.py seed_precios           # Seed default package prices
python manage.py createsuperuser        # Create admin user
pytest                                  # Run all tests
pytest core/tests.py::TestClass::test   # Single test
pytest --cov                            # With coverage
```

### Frontend (from `frontend/`)
```bash
npm run dev       # Dev server :5173 (proxy → :8000)
npm run build     # Production build (tsc -b && vite build)
npm run lint      # ESLint check
npm run preview   # Preview production build
```

---

## API Endpoints

All resources support CRUD at `/api/<resource>/` and filtering by cycle at `/api/ciclos/<ciclo_id>/<resource>/`.

| Resource | Base Endpoint |
|----------|--------------|
| Auth | `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/` |
| Config | `/api/config/` |
| Ciclos | `/api/ciclos/` |
| Alumnos | `/api/alumnos/` or `/api/ciclos/<id>/alumnos/` |
| Profesores | `/api/profesores/` or `/api/ciclos/<id>/profesores/` |
| Talleres | `/api/talleres/` or `/api/ciclos/<id>/talleres/` |
| Horarios | `/api/horarios/` or `/api/ciclos/<id>/horarios/` |
| Matriculas | `/api/matriculas/` or `/api/ciclos/<id>/matriculas/` |
| Asistencias | `/api/asistencias/` or `/api/ciclos/<id>/asistencias/` |
| Recibos | `/api/recibos/` or `/api/ciclos/<id>/recibos/` |
| Precios | `/api/precios/` or `/api/ciclos/<id>/precios/` |
| Pagos Profesores | `/api/pagos-profesores/` |

### Special Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| PATCH | `/api/config/` | Set active cycle |
| GET | `/api/ciclos/<id>/resumen/` | Financial summary of cycle |
| GET | `/api/ciclos/<id>/dashboard/` | Dashboard KPIs |
| POST | `/api/pagos-profesores/calcular-periodo/` | Calculate teacher payments for date range |
| GET | `/api/pagos-profesores/detalle-clase/?horario_id=X&fecha=YYYY-MM-DD` | Student breakdown per class |
| GET | `/api/pagos-profesores/<id>/detalles/` | Payment details for a teacher |
| POST | `/api/matriculas/calcular-precio/` | Calculate recommended price for enrollment |
| GET | `/api/precios/activos/?ciclo_id=X` | Active prices for a cycle (individual + promos) |

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
| `/configuracion-precios` | ConfiguracionPrecios | Protected + Sidebar |
| `/pagos-profesores` | PagosProfesores | Protected + Sidebar |

**Navigation Flow**: Login → `/` (select cycle) → `/dashboard` (with sidebar)

---

## Data Models

### Core Entities
- **Ciclo**: `nombre`, `tipo` (anual/verano/otro), `fecha_inicio`, `fecha_fin`, `activo`
- **Alumno**: `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `fecha_nacimiento`, `activo`
- **Profesor**: `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `fecha_nacimiento`, `activo`
- **Taller**: `ciclo` (FK), `nombre`, `tipo` (instrumento/taller), `descripcion`, `activo`
- **Horario**: `ciclo`, `taller`, `profesor`, `dia_semana`, `hora_inicio/fin`, `cupo_maximo`

### Enrollment & Attendance
- **Matricula**: `alumno`, `taller`, `sesiones_contratadas`, `precio_total`, `concluida`, `metodo_pago`
- **MatriculaHorario**: `matricula`, `horario` (junction: which schedule a student attends)
- **Asistencia**: `matricula`, `horario`, `fecha`, `hora`, `estado`

### Financial
- **Recibo**: `numero`, `alumno` (nullable), `ciclo`, `monto_bruto/total/pagado`, `estado`, `paquete_aplicado`
- **ReciboMatricula**: `recibo`, `matricula` (junction: multi-student receipts)
- **PrecioPaquete**: `ciclo`, `tipo_taller`, `tipo_paquete`, `cantidad_clases`, `cantidad_clases_secundaria`, `precio_total`, `precio_por_sesion`, `activo`
- **PagoProfesor**: `profesor`, `ciclo`, `horas_calculadas`, `monto_final`, `fecha_inicio`, `fecha_fin`, `total_alumnos_asistencias`, `ganancia_taller`
- **PagoProfesorDetalle**: `pago_profesor`, `horario`, `fecha`, `num_alumnos`, `valor_generado`, `monto_base`, `monto_adicional`, `monto_profesor`, `ganancia_taller`

### System
- **Configuracion**: `clave`, `valor` (stores active cycle, global settings)
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

### Price Calculator Logic
The `CalculadoraPrecios` page loads all active prices + promos from `/api/precios/activos/`. Detection:
- **Combo Musical**: 2+ instruments → sorted descending → key `"12+8"` → lookup in `combo_musical` promos
- **Mixto**: 1 instrument + 1 taller → key `"max+min"` → lookup in `mixto` promos
- **Intensivo**: Any item with 20 classes → lookup by `tipo_taller` in `intensivo` promos
- **Discount**: `precioBruto - promo.total`

### Unique Constraint
`(ciclo, tipo_taller, tipo_paquete, cantidad_clases, cantidad_clases_secundaria)` — allows asymmetric combos (12+12 and 12+8 as separate records).

---

## Pagos Profesores - Payment Model

### Formula (per class)
```
0 alumnos   → S/. 0.00
1 alumno   → S/. 17.00 fijo
2+ alumnos → S/. 17.00 base + 50% del valor de sesión de cada alumno adicional
Tope       → Máx S/. 35.00 por clase (excedente = ganancia del taller)
```

### Example
| Alumnos | Valor Sesión | Cálculo | Total Profesor | Ganancia Taller |
|---------|--------------|----------|----------------|-----------------|
| 1 | S/. 20.00 | S/. 17.00 | S/. 17.00 | S/. 3.00 |
| 2 | S/. 20.00 + S/. 16.67 | 17 + 8.34 | S/. 25.34 | S/. 11.33 |
| 3 | S/. 20 + S/. 16.67 + S/. 15 | 17 + 10 + 8 (tope) | S/. 35.00 | S/. 16.67 |

Constants in `core/constants.py`: `BASE_PAGO=17`, `TOPE_MAXIMO=35`, `PORCENTAJE_ADICIONAL=0.50`

---

## Authentication & Security

- **JWT**: Access token 8h, Refresh token 7d, rotation with blacklisting
- **Auth flow**: Login → store tokens in localStorage → axios interceptor adds Bearer header → auto-refresh on 401
- **Protected routes**: `ProtectedRoute` checks localStorage for `access_token` → redirects to `/login`
- **Cycle selection**: Required before accessing any protected page (stored in `Configuracion` DB, NOT localStorage)

---

## Code Style

### Backend (Django/Python)
- **Naming**: `snake_case` for all Python identifiers
- **Validation**: In serializers only, never in views
- **Queries**: Use `select_related` / `prefetch_related` for optimization
- **Models**: One model per file in `core/models/`
- **Views**: One ViewSet per file in `core/views/`
- **Services**: Business logic in `core/services/`, views stay thin
- **Imports**: Group stdlib, third-party, local; use relative imports within app
- **Error handling**: Try-except with specific exceptions, return proper HTTP status codes

### Frontend (React/TypeScript)
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components/interfaces
- **Files**: `PascalCase.tsx` for pages, `camelCase.ts` for utilities
- **HTTP**: axios instance from `api/axios.ts` (handles token refresh automatically)
- **State**: Zustand for auth, React Context for cycle management and toasts
- **Forms**: react-hook-form + zod for validation
- **Styles**: Inline styles (Tailwind removed due to PostCSS issues)
- **Performance**: Wrap page components with `memo()` to prevent unnecessary re-renders
- **Types**: Strict TypeScript; define interfaces in `api/endpoints.ts`

### TypeScript Config
- Target: ES2023, strict mode enabled
- `noUnusedLocals`, `noUnusedParameters` enabled
- JSX: react-jsx transform
- Module: ESNext with bundler resolution

---

## Key Rules

1. **Cycle Selection Required**: Login redirects to `/` (cycle selection). Must select a cycle before accessing other pages.
2. **Active Cycle**: Stored in `Configuracion` DB table, NOT localStorage. Use `PATCH /api/config/` to set.
3. **All entities have FK to Ciclo**: Alumno, Profesor, Taller, Horario all require a ciclo.
4. **Receipts can be multi-student**: `alumno` field is nullable; use `ReciboMatricula` junction table.
5. **Matricula states**: Active by default, can be marked `concluida` (disappears from schedule view).
6. **JWT Tokens**: Access (8h), Refresh (7d) with blacklisting on rotation.
7. **localStorage**: Always wrap in try-catch (fails in private/incognito mode).
8. **Language**: All user-facing text in Spanish.
9. **Horarios filter required**: Taller/instrumento filter is mandatory — no "show all" option.
10. **Pagos Profesores**: Always filter by ciclo + date range to avoid duplicates.
11. **PrecioPaquete combos**: Use `cantidad_clases_secundaria` for asymmetric combos (12+8 vs 12+12).

---

## Contexts & Hooks

### CicloContext
```typescript
const { cicloActual, ciclos, setCicloActual, seleccionarCiclo, recargar, isLoading } = useCiclo();
```
- `cicloActual`: Currently selected cycle object
- `seleccionarCiclo(ciclo)`: Select cycle + redirect to `/dashboard`
- `setCicloActual(ciclo)`: Set cycle without redirect
- `recargar()`: Reload cycle data

### ToastContext
```typescript
const toast = useToast();
toast.showToast('Mensaje', 'success' | 'error' | 'warning');
```

### Auth Store (Zustand)
```typescript
const { login, logout, isLoading } = useAuthStore();
```

---

## Extensibility

### Adding a new entity
1. Create model in `core/models/<entity>.py`, export in `__init__.py`
2. Create serializer in `core/serializers/<entity>.py`, export in `__init__.py`
3. Create ViewSet in `core/views/<entity>_view.py`, export in `__init__.py`
4. Register in `core/urls.py` (router + cycle-filtered routes)
5. Create migration: `python manage.py makemigrations`
6. Add endpoint function in `frontend/src/api/endpoints.ts`
7. Create page in `frontend/src/pages/<Entity>.tsx`
8. Add route in `App.tsx` + sidebar link

### Adding a new payment calculation system
1. Update `core/services/pago_profesor_service.py`
2. Add/remove fields to `PagoProfesor` model if needed
3. Create `PagoProfesorDetalle` entries for per-class breakdown
4. Update serializer in `core/serializers/pago_profesor.py`
5. Create new frontend endpoint if additional data is needed
6. Update `PagosProfesores.tsx` page with new UI

---

## Deployment Notes

### Current State
- **Database**: SQLite3 (file-based, NOT suitable for production)
- **Secrets**: Hardcoded in `config/settings.py` (`SECRET_KEY`, `DEBUG=True`)
- **CORS**: Wide open (`CORS_ALLOW_ALL_ORIGINS = True`)
- **Static files**: No `collectstatic` or whitenoise configured
- **No `.env` file**: Environment variables not externalized

### Vercel Deployment (Frontend Only)
Vercel can host the React frontend as a static SPA. The backend MUST be deployed separately.

**Frontend → Vercel**:
```bash
# In Vercel dashboard:
# - Framework: Vite
# - Build command: npm run build
# - Output directory: dist
# - Environment variable: VITE_API_URL=https://your-backend-url/api
```

**Required `frontend/vercel.json`** for SPA routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Backend options** (pick one):
- **Railway**: Django-friendly, supports SQLite → PostgreSQL migration, auto-deploy from git
- **Render**: Free tier available, PostgreSQL included
- **Fly.io**: Docker-based, good for Django
- **DigitalOcean App Platform**: Managed, PostgreSQL included

**Production checklist before deploying backend**:
1. Switch to PostgreSQL (replace SQLite3 in settings)
2. Move `SECRET_KEY` to env var
3. Set `DEBUG = False`
4. Set `ALLOWED_HOSTS` to your domain
5. Restrict `CORS_ALLOWED_ORIGINS` to frontend domain
6. Add `whitenoise` for static files (or use S3/CDN)
7. Set `VITE_API_URL` in Vercel to backend URL
