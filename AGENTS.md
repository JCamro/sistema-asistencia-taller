# Panel de Asistencia - Documentación para Agentes

## Descripción General

Aplicación web administrativa para gestionar talleres educativo-artísticos. Incluye:
- **Backend**: Django + Django REST Framework + JWT Authentication
- **Frontend**: React + Vite + TypeScript
- **Base de datos**: SQLite3

### Regla Importante
El Login debe redirigir a `/ciclos` obligatoriamente. El usuario debe seleccionar un ciclo antes de acceder al dashboard y otras secciones.

---

## Estructura del Proyecto

```
panel-asistencia/
├── config/                  # Configuración Django
│   ├── settings.py         # Configuraciones principales
│   └── urls.py             # URLs principales
├── core/                   # App principal de Django
│   ├── models/            # Modelos de base de datos
│   ├── views/             # Vistas y ViewSets
│   ├── serializers/       # Serializadores DRF
│   └── urls.py            # URLs de la API
├── frontend/              # Aplicación React
│   ├── src/
│   │   ├── api/          # Endpoints y axios
│   │   ├── components/   # Componentes reutilizables
│   │   ├── contexts/     # Contextos React (CicloContext)
│   │   ├── pages/        # Páginas principales
│   │   └── stores/       # Estados (authStore)
│   └── dist/             # Build de producción
└── db.sqlite3           # Base de datos
```

---

## Routers - BACKEND

### Endpoints Principales

| Recurso | Endpoint | Descripción |
|---------|----------|-------------|
| **Auth** | `POST /api/auth/login/` | Obtener tokens JWT |
| **Auth** | `POST /api/auth/refresh/` | Refresh token |
| **Auth** | `POST /api/auth/logout/` | Logout (blacklist) |
| **Config** | `GET/PATCH /api/config/` | Configuración global |
| **Ciclos** | `GET/POST /api/ciclos/` | Listar/Crear ciclos |
| **Ciclos** | `GET/PATCH/DELETE /api/ciclos/{id}/` | CRUD ciclo |
| **Alumnos** | `GET/POST /api/alumnos/` | Listar/Crear alumnos |
| **Alumnos** | `GET/PATCH/DELETE /api/alumnos/{id}/` | CRUD alumno |
| **Profesores** | `GET/POST /api/profesores/` | Listar/Crear profesores |
| **Profesores** | `GET/PATCH/DELETE /api/profesores/{id}/` | CRUD profesor |
| **Talleres** | `GET/POST /api/talleres/` | Listar/Crear talleres |
| **Talleres** | `GET/PATCH/DELETE /api/talleres/{id}/` | CRUD taller |
| **Horarios** | `GET/POST /api/horarios/` | Listar/Crear horarios |
| **Horarios** | `GET/PATCH/DELETE /api/horarios/{id}/` | CRUD horario |
| **Matrículas** | `GET/POST /api/matriculas/` | Listar/Crear matrículas |
| **Asistencias** | `GET/POST /api/asistencias/` | Listar/Crear asistencias |
| **Recibos** | `GET/POST /api/recibos/` | Listar/Crear recibos |
| **Pagos Profesores** | `GET/POST /api/pagos-profesores/` | Pagos a profesores |

### Endpoints por Ciclo

Todos los recursos pueden filtrarse por ciclo usando la ruta anidada:

```
GET /api/ciclos/{ciclo_id}/alumnos/
GET /api/ciclos/{ciclo_id}/profesores/
GET /api/ciclos/{ciclo_id}/talleres/
GET /api/ciclos/{ciclo_id}/horarios/
GET /api/ciclos/{ciclo_id}/matriculas/
GET /api/ciclos/{ciclo_id}/asistencias/
GET /api/ciclos/{ciclo_id}/recibos/
```

### Endpoints Especiales

```
PATCH /api/config/                 # Actualizar ciclo activo
GET  /api/ciclos/{id}/resumen/    # Resumen del ciclo
POST /api/pagos-profesores/calcular/  # Calcular pagos
```

---

## Routers - FRONTEND

### Rutas de la Aplicación

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/login` | `Login.tsx` | Página de login |
| `/` | `SeleccionCiclos` en App.tsx | Pantalla de selección de ciclos (pantalla completa) |
| `/dashboard` | `Dashboard.tsx` | Dashboard principal (con sidebar oscuro) |
| `/alumnos` | `Alumnos.tsx` | Gestión de alumnos |
| `/profesores` | `Profesores.tsx` | Gestión de profesores |
| `/talleres` | `Talleres.tsx` | Gestión de talleres |
| `/horarios` | `Horarios.tsx` | Gestión de horarios |
| `/matriculas` | `Matriculas.tsx` | Gestión de matrículas |
| `/asistencias` | `Asistencias.tsx` | Gestión de asistencias |
| `/recibos` | `Recibos.tsx` | Gestión de recibos |

---

## Modelos de Datos

### Ciclo
- `id`, `nombre`, `tipo` (anual/verano/otro), `fecha_inicio`, `fecha_fin`, `activo`

### Alumno
- `id`, `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `activo`

### Profesor
- `id`, `ciclo` (FK), `nombre`, `apellido`, `dni`, `telefono`, `email`, `activo`, `es_gerente`

### Taller
- `id`, `ciclo` (FK), `nombre`, `descripcion`, `activo`

### Horario
- `id`, `ciclo` (FK), `taller` (FK), `profesor` (FK), `dia_semana`, `hora_inicio`, `hora_fin`, `cupo_maximo`, `activo`

### Matricula
- `id`, `alumno` (FK), `taller` (FK), `sesiones_contratadas`, `precio_total`, `precio_por_sesion`, `modalidad`, `activo`, `concluida`

### Asistencia
- `id`, `matricula` (FK), `horario` (FK), `fecha`, `hora`, `estado`, `observacion`

### Recibo
- `id`, `numero`, `alumno` (FK), `fecha_emision`, `monto_total`, `monto_pagado`, `saldo_pendiente`, `estado`

### PagoProfesor
- `id`, `profesor` (FK), `ciclo` (FK), `horas_calculadas`, `monto_calculado`, `monto_final`, `fecha_pago`, `estado`

### Configuracion
- `id`, `ciclo_activo` (FK a Ciclo)

---

## API - Funciones del Frontend

### Autenticación
```typescript
login(username, password)  // POST /auth/login/
logout()                   // POST /auth/logout/
```

### Ciclos
```typescript
getCiclos()
getCiclo(id)
createCiclo(data)
updateCiclo(id, data)
deleteCiclo(id)
```

### Recursos (filtrados por ciclo)
```typescript
getAlumnos(cicloId?)
getProfesores(cicloId?)
getTalleres(cicloId?)
getHorarios(cicloId?)
getMatriculas(cicloId?)
getAsistencias(cicloId?)
getRecibos(cicloId?)
```

### Configuración
```typescript
getConfig()
updateConfig({ ciclo_activo: id })
```

---

## Contextos

### CicloContext (`frontend/src/contexts/CicloContext.tsx`)
Proveedor que gestiona el ciclo activo:
- `cicloActual`: Ciclo seleccionado actualmente
- `ciclos`: Lista de todos los ciclos
- `setCicloActual(ciclo)`: Establecer ciclo actual (sin redirect)
- `seleccionarCiclo(ciclo)`: Seleccionar ciclo y redirigir a /dashboard
- `recargar()`: Recargar datos
- `isLoading`: Estado de carga

### useCiclo Hook
```typescript
const { cicloActual, ciclos, setCicloActual, seleccionarCiclo, recargar, isLoading } = useCiclo();
```

---

## Reglas de Desarrollo

### Backend
1. **Validaciones**: Todas las validaciones deben estar en los serializadores, nunca en las vistas
2. **Consultas**: Usar `select_related` y `prefetch_related` para optimizar queries
3. **Autenticación**: JWT con tokens de acceso (8h) y refresh (7 días)

### Frontend
1. **HTTP**: Usar `fetch` nativo (no axios por problemas de build)
2. **Estilos**: Estilos inline (Tailwind eliminado por errores de PostCSS)
3. **Flujo**:
   - Login → Redirige a `/ciclos`
   - Usuario debe seleccionar ciclo
   - Solo después puede ver dashboard y otras secciones

---

## Ejecución del Proyecto

### Backend
```bash
cd panel-asistencia
python manage.py runserver
# Servidor en http://localhost:8000
```

### Frontend
```bash
cd frontend
npm run dev
# Servidor en http://localhost:5173
```

---

## Notas Importantes

1. **Ciclo activo**: Se guarda en la tabla `Configuracion` de la base de datos, NO en localStorage
2. **Protección de rutas**: El componente `ProtectedRoute` verifica que exista token
3. **Flujo de navegación**:
   - Login → `/` (Selección de ciclos - pantalla completa)
   - Selección de ciclo → `/dashboard` (con sidebar oscuro)
   - El sidebar muestra el ciclo actual en la sección "CICLO ACTIVO"
4. **Estructura**: Todas las entidades (Alumnos, Profesores, Talleres) tienen FK obligatoria a Ciclo
5. **Idioma**: Toda la aplicación debe responder en español
6. **Optimizaciones**: Componentes memoizados con `memo()` para evitar re-renders innecesarios
