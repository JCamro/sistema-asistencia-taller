# AGENTS.md - Panel de Asistencia

## Overview

Administrative web app for managing educational-artistic workshops.
- **Backend**: Django 6 + DRF + SimpleJWT (SQLite3)
- **Frontend**: React 19 + Vite + TypeScript + Zustand
- **Language**: Spanish (all user-facing text)

---

## Architecture

```
├── config/              # Django settings, URLs
├── core/                # Main Django app
│   ├── models/          # Data models (one file per entity)
│   ├── serializers/     # DRF serializers
│   ├── views/           # ViewSets (one file per entity)
│   ├── management/      # Management commands
│   └── urls.py          # API routing
├── frontend/
│   └── src/
│       ├── api/         # axios instance + endpoints
│       ├── components/  # Reusable components
│       ├── contexts/    # React contexts (CicloContext, ToastContext)
│       ├── pages/       # Page components
│       └── stores/      # Zustand stores
└── db.sqlite3
```

---

## Commands

### Backend (from root)
```bash
python manage.py runserver              # Start server :8000
python manage.py makemigrations         # Create migrations
python manage.py migrate               # Apply migrations
python manage.py shell                 # Django shell
python manage.py <command>             # Management commands
pytest                                 # Run all tests (requires pytest-django)
pytest core/tests.py::TestClass::test_method  # Single test
pytest --cov                           # With coverage
```

### Frontend (from frontend/)
```bash
npm run dev       # Dev server :5173
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
| Pagos Profesores | `/api/pagos-profesores/` |

### Special Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| PATCH | `/api/config/` | Set active cycle |
| GET | `/api/ciclos/<id>/resumen/` | Financial summary of cycle |
| POST | `/api/pagos-profesores/calcular-periodo/` | Calculate teacher payments for date range |
| GET | `/api/pagos-profesores/detalle-clase/?horario_id=X&fecha=YYYY-MM-DD` | Get student breakdown per class |
| GET | `/api/pagos-profesores/<id>/detalles/` | Get payment details for a teacher |
| POST | `/api/matriculas/calcular-precio/` | Calculate recommended price for a enrollment |

---

## Frontend Routes

| Path | Component | Access |
|------|-----------|--------|
| `/login` | Login | Public |
| `/` | SeleccionCiclos | Protected (cycle selection screen) |
| `/dashboard` | Dashboard | Protected + Sidebar |
| `/alumnos` | Alumnos | Protected + Sidebar |
| `/profesores` | Profesores | Protected + Sidebar |
| `/talleres` | Talleres | Protected + Sidebar |
| `/horarios` | Horarios | Protected + Sidebar |
| `/matriculas` | Matriculas | Protected + Sidebar |
| `/asistencias` | Asistencias | Protected + Sidebar |
| `/recibos` | Recibos | Protected + Sidebar |
| `/calculadora` | CalculadoraPrecios | Protected + Sidebar |
| `/pagos-profesores` | PagosProfesores | Protected + Sidebar |

**Navigation Flow**: Login → `/` (select cycle) → `/dashboard` (with sidebar)

---

## Data Models

- **Ciclo**: `nombre`, `tipo` (anual/verano/otro), `fecha_inicio`, `fecha_fin`, `activo`
- **Alumno/Profesor**: `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `activo`
- **Taller**: `ciclo` (FK), `nombre`, `tipo` (instrumento/taller), `descripcion`, `activo`
- **Horario**: `ciclo`, `taller`, `profesor`, `dia_semana`, `hora_inicio/fin`, `cupo_maximo`
- **Matricula**: `alumno`, `taller`, `sesiones_contratadas`, `precio_total`, `concluida`, `metodo_pago`
- **Asistencia**: `matricula`, `horario`, `fecha`, `hora`, `estado`
- **Recibo**: `numero`, `alumno` (nullable), `ciclo`, `monto_bruto/total/pagado`, `estado`, `paquete_aplicado`
- **PrecioPaquete**: `tipo_taller`, `tipo_paquete`, `cantidad_clases`, `precio_total`, `precio_por_sesion`
- **PagoProfesor**: `profesor`, `ciclo`, `horas_calculadas`, `monto_final`, `fecha_inicio`, `fecha_fin`, `total_alumnos_asistencias`, `ganancia_taller`
- **PagoProfesorDetalle**: `pago_profesor`, `horario`, `fecha`, `num_alumnos`, `valor_generado`, `monto_base`, `monto_adicional`, `monto_profesor`, `ganancia_taller`

---

## Pagos Profesores - Modelo de Pago Dinámico

### Fórmula de Cálculo (por clase)

```
0 alumnos   → S/. 0.00
1 alumno   → S/. 17.00 fijo
2+ alumnos → S/. 17.00 base + 50% del valor de sesión de cada alumno adicional
Tope       → Máx S/. 35.00 por clase (excedente = ganancia del taller)
```

### Ejemplo
| Alumnos | Valor Sesión | Cálculo | Total Profesor | Ganancia Taller |
|---------|--------------|----------|----------------|-----------------|
| 1 | S/. 20.00 | S/. 17.00 | S/. 17.00 | S/. 3.00 |
| 2 | S/. 20.00 + S/. 16.67 | 17 + 8.34 | S/. 25.34 | S/. 11.33 |
| 3 | S/. 20 + S/. 16.67 + S/. 15 | 17 + 10 + 8 (tope) | S/. 35.00 | S/. 16.67 |

---

## Code Style

### Backend (Django/Python)
- **Naming**: `snake_case` for all Python identifiers
- **Validation**: In serializers only, never in views
- **Queries**: Use `select_related` / `prefetch_related` for optimization
- **Models**: One model per file in `core/models/`
- **Views**: One ViewSet per file in `core/views/`
- **Imports**: Group stdlib, third-party, local; use relative imports within app
- **Error handling**: Try-except with specific exceptions, return proper HTTP status codes

### Frontend (React/TypeScript)
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components/interfaces
- **Files**: `kebab-case.tsx` for pages, `camelCase.ts` for utilities
- **HTTP**: axios instance from `api/axios.ts` (handles token refresh automatically)
- **State**: Zustand for global state, React Context for cycle management
- **Forms**: react-hook-form + zod for validation
- **Styles**: Inline styles (Tailwind removed due to PostCSS issues)
- **Performance**: Wrap components with `memo()` to prevent unnecessary re-renders
- **Types**: Strict TypeScript; define interfaces in `api/endpoints.ts`

### TypeScript Config
- Target: ES2023, strict mode enabled
- `noUnusedLocals`, `noUnusedParameters` enabled
- JSX: react-jsx transform

---

## Key Rules

1. **Cycle Selection Required**: Login redirects to `/ciclos`. User must select a cycle before accessing other pages.
2. **Active Cycle**: Stored in `Configuracion` DB table, NOT localStorage.
3. **All entities have FK to Ciclo**: Alumno, Profesor, Taller, Horario all require a ciclo.
4. **Receipts can be multi-student**: `alumno` field is nullable; use `ReciboMatricula` junction table.
5. **Matricula states**: Active by default, can be marked `concluida` (disappears from schedule view).
6. **JWT Tokens**: Access (8h), Refresh (7d) with blacklisting on rotation.
7. **localStorage**: Always wrap in try-catch (fails in private/incognito mode).
8. **Language**: All user-facing text in Spanish.
9. **Horarios filter required**: Taller/instrumento filter is mandatory - no "show all" option.
10. **Pagos Profesores**: Always filter by ciclo + date range to avoid duplicates.

---

## Contexts & Hooks

### CicloContext
```typescript
const { cicloActual, ciclos, setCicloActual, seleccionarCiclo, recargar, isLoading } = useCiclo();
```
- `cicloActual`: Currently selected cycle object
- `seleccionarCiclo(ciclo)`: Select cycle + redirect to /dashboard
- `setCicloActual(ciclo)`: Set cycle without redirect
- `recargar()`: Reload cycle data

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
1. Update `calcular_pago_profesor` in `core/views/pago_profesor_view.py`
2. Add/remove fields to `PagoProfesor` model if needed
3. Create `PagoProfesorDetalle` model for per-class breakdown
4. Update serializer in `core/serializers/pago_profesor.py`
5. Create new frontend endpoint if additional data is needed
6. Update `PagosProfesores.tsx` page with new UI
