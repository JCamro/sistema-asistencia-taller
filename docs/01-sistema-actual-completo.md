# Sistema Actual — Documentación Completa

> **Fecha**: Julio 2026  
> **Versión**: v1 (en producción)  
> **Propósito**: Documentar TODO el sistema actual, la base de datos, los flujos, y las features que faltan.

---

## Tabla de Contenidos

1. [¿Qué es este sistema?](#1--qué-es-este-sistema)
2. [Stack Tecnológico](#2--stack-tecnológico)
3. [Base de Datos — Modelos](#3--base-de-datos--modelos)
4. [Relaciones entre Modelos](#4--relaciones-entre-modelos)
5. [Flujos del Sistema](#5--flujos-del-sistema)
6. [Problemas de Diseño Actuales](#6--problemas-de-diseño-actuales)
7. [Features que Faltan](#7--features-que-faltan)
8. [API Endpoints](#8--api-endpoints)

---

## 1. ¿Qué es este sistema?

Es un **panel de administración para un taller de música** ("Taller de Música Elguera"). Gestiona:

| Módulo | Descripción |
|--------|-------------|
| **Alumnos** | Personas que toman clases de instrumentos o talleres |
| **Profesores** | Personas que enseñan en horarios específicos |
| **Talleres** | Instrumentos (guitarra, batería) o talleres (canto, composición) |
| **Horarios** | Día + hora + taller + profesor (ej: "Guitarra - Lunes 10:00 - Prof. Carlos") |
| **Matrículas** | Inscripción de alumno a un taller con N sesiones contratadas |
| **Asistencias** | Registro de si el alumno asistió, falta, o falta grave |
| **Recibos** | Pagos de los alumnos (individuales o grupales) |
| **Pagos a Profesores** | Cálculo de cuánto se le paga a cada profesor |
| **Egresos** | Gastos del taller (alquiler, útiles, etc.) |
| **Ciclos** | Períodos académicos (2026-Anual, 2026-Verano, etc.) |

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | Django 6.0.3 + DRF 3.17.1 + SimpleJWT 5.5.1 |
| **Base de datos (dev)** | SQLite |
| **Base de datos (prod)** | PostgreSQL (Railway) |
| **Frontend admin** | React 19 + Vite 8 + TypeScript 5.9 + Zustand |
| **Frontend docente** | React + Vite (portal-docente/) |
| **Auth** | JWT (Access 8h, Refresh 7d) |
| **Deploy** | Railway (backend) + Vercel (frontend) |
| **Timezone** | `America/Lima` (UTC-5) |
| **Idioma** | Español (todo el UI) |

---

## 3. Base de Datos — Modelos

### 3.1 CICLO

**Archivo**: `core/models/ciclo.py`

El "período académico". Todo se organiza por ciclo.

```
ciclo
├── id                    (auto)
├── nombre                (varchar 100) "2026-Anual"
├── tipo                  (varchar 20)  anual | verano | otro
├── fecha_inicio          (date)
├── fecha_fin             (date)
├── activo                (bool)        ¿Es el ciclo vigente?
├── created_at            (datetime)
└── updated_at            (datetime)
```

**Reglas**:
- Solo un ciclo puede estar `activo=True` a la vez (seleccionado en Configuración)
- Un ciclo define el período de validez de todas las entidades asociadas

---

### 3.2 ALUMNO

**Archivo**: `core/models/alumno.py`

```
alumno
├── id                    (auto)
├── ciclo_id              (FK → Ciclo)  ⚠️ PROBLEMA: duplica personas
├── nombre                (varchar 100)
├── apellido              (varchar 100)
├── dni                   (varchar 15)
├── telefono              (varchar 20, nullable)
├── email                 (email, nullable)
├── fecha_nacimiento      (date, nullable)
├── activo                (bool)        ⚠️ AMBIGUO: ¿está matriculado?
├── created_at            (datetime)
└── updated_at            (datetime)

UNIQUE: (ciclo, dni)
```

**⚠️ PROBLEMA CRÍTICO**:
- `ciclo FK` significa que si "Juan García" (DNI 12345678) pasa de ciclo 2025 a 2026, se crea un **registro nuevo**
- Hay 2 "Juan García" en la base de datos, con diferentes IDs
- No hay forma de saber que son la misma persona (solo el DNI coincide)

**⚠️ PROBLEMA DE AMBIGÜEDAD**:
- `activo = True` no significa "está tomando clases ahora"
- Significa "el registro está habilitado" (no borrado lógicamente)
- Un alumno puede tener `activo=True` pero ninguna matrícula activa

---

### 3.3 PROFESOR

**Archivo**: `core/models/profesor.py`

```
profesor
├── id                    (auto)
├── ciclo_id              (FK → Ciclo)  ⚠️ Mismo problema que Alumno
├── nombre                (varchar 100)
├── apellido              (varchar 100)
├── dni                   (varchar 15)
├── telefono              (varchar 20, nullable)
├── email                 (email, nullable)
├── fecha_nacimiento      (date, nullable)
├── activo                (bool)
├── es_gerente            (bool)        ¿Es gerente del taller?
├── observaciones         (text, nullable)
├── created_at            (datetime)
└── updated_at            (datetime)

UNIQUE: (ciclo, dni)
```

**Mismo problema que Alumno**: un profesor que trabaja en múltiples ciclos tiene múltiples registros.

---

### 3.4 TALLER

**Archivo**: `core/models/taller.py`

```
taller
├── id                    (auto)
├── ciclo_id              (FK → Ciclo)  ⚠️ Duplica talleres
├── nombre                (varchar 100) "Guitarra", "Batería"
├── tipo                  (varchar 20)  instrumento | taller
├── descripcion           (text, nullable)
├── activo                (bool)
├── created_at            (datetime)
└── updated_at            (datetime)

UNIQUE: (ciclo, nombre)
```

**Tipos**:
- `instrumento`: Guitarra, Batería, Piano, Bajo, etc.
- `taller`: Taller de Canto, Composición, Producción, etc.

---

### 3.5 HORARIO

**Archivo**: `core/models/horario.py`

```
horario
├── id                    (auto)
├── ciclo_id              (FK → Ciclo)
├── taller_id             (FK → Taller)
├── profesor_id           (FK → Profesor)
├── dia_semana            (int) 0=Lunes, 1=Martes... 6=Domingo
├── hora_inicio           (time) "10:00"
├── hora_fin              (time) "11:00"
├── tipo_pago             (varchar 10)  dinámico | fijo
├── monto_fijo            (decimal, nullable)  S/. si es fijo
├── cupo_maximo           (positive int) default=10
├── activo                (bool)
├── created_at            (datetime)
└── updated_at            (datetime)

UNIQUE: (ciclo, taller, profesor, dia_semana, hora_inicio)
```

**Propiedad calculada**:
- `cupo_disponible`: cupo_maximo - (alumnos activos en ese horario)

**Tipos de pago**:
- `dinámico`: se calcula por alumno asistente (fórmula en PagoProfesor)
- `fijo`: monto fijo por clase sin importar alumnos

---

### 3.6 MATRÍCULA

**Archivo**: `core/models/matricula.py`

La inscripción de un alumno a un taller. **Es la entidad central del sistema**.

```
matricula
├── id                    (auto)
├── alumno_id             (FK → Alumno)
├── ciclo_id              (FK → Ciclo)
├── taller_id             (FK → Taller)
├── sesiones_contratadas  (positive int) 12, 8, 20...
├── precio_total          (decimal) S/. 200
├── precio_por_sesion     (decimal) S/. 16.67
├── metodo_pago           (varchar 20) efectivo | transferencia | tarjeta | otro
├── observaciones         (text, nullable)
├── fecha_matricula       (datetime) default=now
├── activo                (bool)     ¿Tiene sesiones disponibles?
├── concluida             (bool)     ¿Se agotaron las sesiones?
├── created_at            (datetime)
└── updated_at            (datetime)
```

**Propiedades calculadas**:
```python
sesiones_consumidas = asistencias.filter(estado__in=['asistio', 'falta_grave']).count()
sesiones_disponibles = max(0, sesiones_contratadas - sesiones_consumidas)
```

**Estados posibles**:
| Estado | Significado |
|--------|-------------|
| `activo=True, concluida=False` | Tiene sesiones disponibles (.NORMAL) |
| `activo=False, concluida=True` | Se agotaron las sesiones |
| `activo=False, concluida=False` | Borrado lógico (raro) |

**⚠️ PROBLEMA**:
- Cuando `concluida=True`, el alumno **desaparece** de la vista de asistencias
- No hay alerta automática de "este alumno concluyó"
- No hay historial de cuándo concluyó

---

### 3.7 MATRÍCULA-HORARIO (Junction Table)

**Archivo**: `core/models/matricula_horario.py`

Vincula una matrícula con los horarios a los que asiste el alumno.

```
matricula_horario
├── id                    (auto)
├── matricula_id          (FK → Matricula)
├── horario_id            (FK → Horario)
└── created_at            (datetime)

UNIQUE: (matricula, horario)
```

**Ejemplo**:
- Matrícula #45 (Juan - Guitarra) → Horario #1 (Lunes 10:00) + Horario #3 (Miércoles 10:00)
- Juan asiste 2 veces por semana, consume 2 sesiones por semana

---

### 3.8 ASISTENCIA

**Archivo**: `core/models/asistencia.py`

```
asistencia
├── id                    (auto)
├── matricula_id          (FK → Matricula, nullable)
├── horario_id            (FK → Horario)
├── profesor_id           (FK → Profesor)
├── fecha                 (date, indexed)
├── hora                  (time)
├── estado                (varchar 20) asistio | falta | falta_grave
├── observacion           (text, nullable)
├── es_recuperacion       (bool) default=False
├── created_at            (datetime)
└── updated_at            (datetime)

UNIQUE: (matricula, horario, fecha)
INDEX: (horario, fecha)
```

**Estados**:
| Estado | Significado | Descuenta sesión |
|--------|-------------|------------------|
| `asistio` | Asistió a clase | ✅ Sí |
| `falta` | No asistió | ❌ No |
| `falta_grave` | No asistió + justificación grave | ✅ Sí (penalización) |

**⚠️ NOTA**: `falta_grave` SÍ descuenta sesión (es una penalización mayor que falta normal).

**Reglas de negocio**:
- No se puede registrar asistencia antes de `fecha_matricula`
- Un alumno no puede tener 2 asistencias en el mismo horario y fecha
- Las asistencias de recuperación (`es_recuperacion=True`) son para alumnos que faltaron y recuperaron después

---

### 3.9 PRECIO-PAQUETE

**Archivo**: `core/models/precio_paquete.py`

Define los precios para cada tipo de taller y cantidad de clases.

```
precio_paquete
├── id                          (auto)
├── ciclo_id                    (FK → Ciclo, nullable) null=global
├── tipo_taller                 (varchar 20) instrumento | taller
├── tipo_paquete                (varchar 20) individual | combo_musical | mixto | intensivo
├── cantidad_clases             (int) 12, 8, 20...
├── cantidad_clases_secundaria  (int, nullable) Para combos: 12+8
├── precio_total                (decimal) S/. 200
├── precio_por_sesion           (decimal) S/. 16.67
├── activo                      (bool)
├── created_at                  (datetime)
└── updated_at                  (datetime)

UNIQUE: (ciclo, tipo_taller, tipo_paquete, cantidad_clases, cantidad_clases_secundaria)
```

**Tipos de paquete**:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `individual` | Un solo instrumento/taller | Guitarra 12 clases = S/. 200 |
| `combo_musical` | 2 instrumentos | Guitarra + Piano 12+12 = S/. 350 |
| `mixto` | 1 instrumento + 1 taller | Guitarra + Canto 12+8 = S/. 280 |
| `intensivo` | Paquete grande (20 clases) | Guitarra 20 = S/. 300 |

**Lógica de búsqueda**:
1. Busca precio específico del ciclo
2. Si no existe, busca precio global (`ciclo_id=None`)
3. Si no existe, no calcula precio

---

### 3.10 RECIBO

**Archivo**: `core/models/recibo.py`

```
recibo
├── id                    (auto)
├── numero                (varchar 20, unique) "REC-2026-001"
├── alumno_id             (FK → Alumno, nullable) principal
├── ciclo_id              (FK → Ciclo)
├── fecha_emision         (date)
├── monto_bruto           (decimal) S/. 200 (sin descuento)
├── descuento             (decimal) S/. 30 (si aplica combo)
├── monto_total           (decimal) S/. 170
├── monto_pagado          (decimal) S/. 170
├── paquete_aplicado      (varchar 30) individual | combo_musical_12_8...
├── precio_editado        (bool) ¿Se editó manualmente?
├── metodo_pago           (varchar 20) efectivo | transferencia | yape | plin
├── estado                (varchar 20) pendiente | pagado | anulado
├── observacion           (text, nullable)
├── created_at            (datetime)
└── updated_at            (datetime)
```

**Propiedades calculadas**:
```python
saldo_pendiente = max(0, monto_total - monto_pagado)
porcentaje_descuento = (descuento / monto_bruto) * 100
```

**Recibos multi-alumno**:
- Un recibo puede cubrir múltiples matrículas (ej: hermanos)
- Se usa la junction table `ReciboMatricula`

---

### 3.11 RECIBO-MATRÍCULA (Junction Table)

**Archivo**: `core/models/recibo_matricula.py`

```
recibo_matricula
├── id                    (auto)
├── recibo_id             (FK → Recibo)
├── matricula_id          (FK → Matricula)
├── monto                 (decimal) S/. cuánto cubre
└── created_at            (datetime)

UNIQUE: (recibo, matricula)
```

---

### 3.12 PAGO-PROFESOR

**Archivo**: `core/models/pago_profesor.py`

Resumen de pago a un profesor por un período.

```
pago_profesor
├── id                        (auto)
├── profesor_id               (FK → Profesor)
├── ciclo_id                  (FK → Ciclo)
├── horas_calculadas          (decimal) 8.5 horas
├── monto_calculado           (decimal) S/. 170 (cálculo automático)
├── monto_final               (decimal) S/. 170 (ajuste manual)
├── fecha_inicio              (date, nullable)
├── fecha_fin                 (date, nullable)
├── total_alumnos_asistencias (positive int) 45 alumnos
├── ganancia_taller           (decimal) S/. 50
├── fecha_pago                (date, nullable)
├── estado                    (varchar 20) calculado | pagado | anulado
├── observacion               (text, nullable)
├── created_at                (datetime)
└── updated_at                (datetime)
```

---

### 3.13 PAGO-PROFESOR-DETALLE

**Archivo**: `core/models/pago_profesor_detalle.py`

Detalle día por día de la trabajo del profesor.

```
pago_profesor_detalle
├── id                    (auto)
├── pago_profesor_id      (FK → PagoProfesor)
├── horario_id            (FK → Horario)
├── fecha                 (date)
├── num_alumnos           (positive int) 5
├── valor_generado        (decimal) S/. 25
├── monto_base            (decimal) S/. 17
├── monto_adicional       (decimal) S/. 8
├── monto_profesor        (decimal) S/. 25
├── ganancia_taller       (decimal) S/. 0
├── created_at            (datetime)
└── updated_at            (datetime)
```

**Fórmula de cálculo**:
```
0 alumnos → S/. 0.00
1 alumno  → S/. 17.00 (BASE_PAGO) fijo
2+ alumnos → S/. 17.00 + (50% × valor_sesión × alumnos_adicionales)
Tope       → Máx S/. 35.00 (TOPE_MAXIMO) por clase
```

**Ejemplo**:
- 5 alumnos en Guitarra Lunes 10:00
- Base: S/. 17
- Adicional: 50% × S/. 17 × 4 alumnos = S/. 34
- Total: S/. 17 + S/. 34 = S/. 51 → pero tope es S/. 35 → **S/. 35**

---

### 3.14 EGRESO

**Archivo**: `core/models/egreso.py`

```
egreso
├── id                    (auto)
├── tipo                  (varchar 20) gasto_taller | pago_profesor | gasto_personal
├── monto                 (decimal) S/. 50 (min: 0.01)
├── descripcion           (varchar 255, nullable)
├── fecha                 (date)
├── metodo_pago           (varchar 20) efectivo | transferencia | yape | plin
├── categoria             (varchar 50, nullable) Solo para gasto_taller
├── beneficiario          (varchar 150, nullable)
├── profesor_id           (FK → Profesor, nullable)
├── ciclo_id              (FK → Ciclo)
├── estado                (varchar 20) pendiente | cancelado
├── created_at            (datetime)
└── updated_at            (datetime)
```

---

### 3.15 CONFIGURACIÓN (Singleton)

**Archivo**: `core/models/configuracion.py`

```
configuracion (pk=1 siempre)
├── ciclo_activo_id       (FK → Ciclo, nullable)
├── pago_dinamico_base    (decimal) S/. 17.00
├── pago_dinamico_tope    (decimal) S/. 35.00
├── created_at            (datetime)
└── updated_at            (datetime)
```

**Singleton**: Solo existe 1 registro (pk=1). Se usa `Configuracion.get_instance()`.

---

### 3.16 HISTORIAL-TRASPASO

**Archivo**: `core/models/historial_traspaso.py`

Registra cuando se transfiere una matrícula de un alumno a otro.

```
historial_traspaso
├── id                        (auto)
├── matricula_origen_id       (FK → Matricula)
├── matricula_destino_id      (FK → Matricula)
├── alumno_origen_id          (FK → Alumno)
├── alumno_destino_id         (FK → Alumno)
├── ciclo_id                  (FK → Ciclo)
├── taller_id                 (FK → Taller)
├── fecha_traspaso            (datetime) auto
└── asistencias_transferidas  (positive int) 3
```

---

## 4. Relaciones entre Modelos

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAPA DE RELACIONES                          │
└─────────────────────────────────────────────────────────────────────┘

CICLO (1) ──────────────── (N) ALUMNO
    │
    ├── (N) PROFESOR
    ├── (N) TALLER
    ├── (N) HORARIO
    ├── (N) MATRICULA
    ├── (N) RECIBO
    ├── (N) EGRESO
    └── (N) PAGO_PROFESOR

TALLER (1) ─────────────── (N) HORARIO
PROFESOR (1) ────────────── (N) HORARIO

ALUMNO (1) ──────────────── (N) MATRICULA
    │
    └── (N) RECIBO (nullable)

MATRICULA (1) ───────────── (N) MATRICULA_HORARIO
HORARIO (1) ─────────────── (N) MATRICULA_HORARIO

MATRICULA (1) ───────────── (N) ASISTENCIA
HORARIO (1) ─────────────── (N) ASISTENCIA
PROFESOR (1) ────────────── (N) ASISTENCIA

RECIBO (1) ──────────────── (N) RECIBO_MATRICULA
MATRICULA (1) ───────────── (N) RECIBO_MATRICULA

PROFESOR (1) ────────────── (N) PAGO_PROFESOR
PAGO_PROFESOR (1) ───────── (N) PAGO_PROFESOR_DETALLE
HORARIO (1) ─────────────── (N) PAGO_PROFESOR_DETALLE
```

---

## 5. Flujos del Sistema

### 5.1 Configuración Inicial (una vez por ciclo)

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: Crear Ciclo                                            │
│  Admin crea "2026-Anual" (enero-diciembre 2026)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: Crear Talleres                                         │
│  - Guitarra (instrumento)                                       │
│  - Batería (instrumento)                                        │
│  - Taller de Canto (taller)                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: Crear Profesores                                       │
│  - Carlos López (DNI: 11111111)                                 │
│  - María García (DNI: 22222222)                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: Crear Horarios                                         │
│  - Guitarra - Lunes 10:00-11:00 - Prof. Carlos                 │
│  - Guitarra - Miércoles 10:00-11:00 - Prof. Carlos             │
│  - Batería - Martes 14:00-15:00 - Prof. María                  │
│  - Canto - Jueves 16:00-17:00 - Prof. María                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 5: Configurar Precios                                     │
│  - Guitarra 8 clases = S/. 120                                  │
│  - Guitarra 12 clases = S/. 180                                 │
│  - Batería 12 clases = S/. 200                                  │
│  - Combo (Guitarra + Piano) 12+12 = S/. 350                    │
│  - Mixto (Guitarra + Canto) 12+8 = S/. 280                     │
│  - Intensivo 20 clases = S/. 300                                │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Matrícula de Alumno (flujo principal)

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: Buscar o crear Alumno                                  │
│  "Juan García" (DNI: 12345678)                                  │
│  Si no existe → crear con ciclo=2026-Anual                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: Crear Matrícula                                        │
│  - Alumno: Juan García                                          │
│  - Taller: Guitarra                                             │
│  - Sesiones contratadas: 12                                     │
│  - Precio: S/. 180 (individual 12 clases)                       │
│  - Método de pago: efectivo                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: Vincular a Horarios                                    │
│  Juan asiste:                                                   │
│  - Lunes 10:00 (Guitarra - Prof. Carlos)                        │
│  - Miércoles 10:00 (Guitarra - Prof. Carlos)                    │
│  → 2 sesiones por semana × 6 semanas = 12 sesiones             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: Crear Recibo                                           │
│  - Número: REC-2026-001                                         │
│  - Alumno principal: Juan García                                │
│  - Monto bruto: S/. 180                                         │
│  - Paquete: individual                                          │
│  - Descuento: S/. 0                                             │
│  - Monto total: S/. 180                                         │
│  - Método de pago: efectivo                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 5: Registrar Pago                                         │
│  Familia paga S/. 180 en efectivo                               │
│  Admin marca recibo como "Pagado"                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.3 Registro Diario de Asistencia (lo que hace el profesor)

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: Profesor abre Portal Docente                           │
│  Login: DNI / DNI (contraseña default)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: Seleccionar Horario                                    │
│  "Guitarra - Lunes 10:00"                                       │
│  Fecha: 2026-07-07 (hoy es lunes)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: Sistema muestra alumnos                                │
│  GET /api/ciclos/1/asistencias/por-horario/                     │
│  ?horario_id=1&fecha=2026-07-07                                 │
│                                                                 │
│  Respuesta:                                                     │
│  [                                                              │
│    {                                                            │
│      "matricula_id": 45,                                        │
│      "alumno_nombre": "Juan García",                            │
│      "sesiones_disponibles": 8,                                 │
│      "ya_registro_hoy": false                                   │
│    },                                                           │
│    {                                                            │
│      "matricula_id": 46,                                        │
│      "alumno_nombre": "Ana López",                              │
│      "sesiones_disponibles": 3,                                 │
│      "ya_registro_hoy": false                                   │
│    }                                                            │
│  ]                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: Profesor marca asistencia                              │
│  - Juan García: ✅ Asistió                                      │
│  - Ana López: ❌ Falta                                          │
│                                                                 │
│  POST /api/asistencias/                                         │
│  {                                                              │
│    "matricula": 45,                                             │
│    "horario": 1,                                                │
│    "fecha": "2026-07-07",                                       │
│    "hora": "10:00:00",                                          │
│    "estado": "asistio"                                          │
│  }                                                              │
│                                                                 │
│  POST /api/asistencias/                                         │
│  {                                                              │
│    "matricula": 46,                                             │
│    "horario": 1,                                                │
│    "fecha": "2026-07-07",                                       │
│    "hora": "10:00:00",                                          │
│    "estado": "falta"                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 5: Actualizar sesiones                                    │
│  Juan: 12 - 1 = 11 sesiones disponibles                        │
│  Ana: 12 - 0 = 12 sesiones disponibles (falta no descuenta)    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.4 Cuando un Alumno Agota sus Sesiones

```
┌─────────────────────────────────────────────────────────────────┐
│  SITUACIÓN: Juan llegó a 0 sesiones disponibles                 │
│  (asistió 12 veces de 12 contratadas)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CONSECUENCIA:                                                  │
│  - matricula.concluida = True                                   │
│  - matricula.activo = False                                     │
│  - Juan DESAPARECE de la vista de asistencias                   │
│  - El profesor ya no lo ve en su lista de alumnos               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ PROBLEMA:                                                   │
│  - Si el admin olvidó avisar a la familia, no hay alerta       │
│  - No hay forma de saber "quién concluyó hoy"                  │
│  - No hay botón para renovar matrícula rápidamente              │
│  - Si el admin no está en el sistema, la familia no puede       │
│    renovar (no hay portal de alumno)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.5 Cálculo de Pago a Profesores (fin de mes)

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: Seleccionar período                                    │
│  Profesor: Carlos López                                         │
│  Período: 01/07/2026 - 31/07/2026                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: Sistema calcula automáticamente                        │
│  GET /api/pagos-profesores/calcular-periodo/                    │
│  ?profesor_id=1&fecha_inicio=2026-07-01&fecha_fin=2026-07-31   │
│                                                                 │
│  Cuenta todas las asistencias donde:                            │
│  - horario.profesor = Carlos                                    │
│  - asistencia.fecha EN el período                               │
│  - asistencia.estado IN (asistio, falta_grave)                  │
│                                                                 │
│  Resultado:                                                     │
│  - 20 clases impartidas                                         │
│  - 85 alumnos asistieron en total                               │
│  - Promedio: 4.25 alumnos/clase                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: Aplicar fórmula                                        │
│  Por cada clase:                                                │
│  - 1 alumno: S/. 17 (fijo)                                     │
│  - 2+ alumnos: S/. 17 + (50% × S/. 17 × (n-1))                │
│  - Tope: S/. 35                                                 │
│                                                                 │
│  Ejemplo: 5 alumnos                                             │
│  = S/. 17 + (0.5 × 17 × 4) = S/. 17 + 34 = S/. 51            │
│  → Tope S/. 35 → se paga S/. 35                                │
│                                                                 │
│  Total mes: 20 clases × S/. 35 = S/. 700                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: Admin revisa y ajusta                                  │
│  - Puede editar monto_final (ej: bono, descuento)               │
│  - Marca como "Pagado"                                          │
│  - Se crea egreso automáticamente                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Problemas de Diseño Actuales

### 6.1 Duplicación de Entidades por Ciclo

```
PROBLEMA:
Si "Juan García" (DNI 12345678) toma Guitarra en 2025 y 2026:

2025: Alumno(id=1, ciclo=2025, nombre="Juan", dni="12345678")
2026: Alumno(id=2, ciclo=2026, nombre="Juan", dni="12345678")

Son 2 registros diferentes con el mismo DNI.
No hay forma de saber que son la misma persona.

CONSECUENCIAS:
- No hay historial unificado del alumno
- Si el alumno quiere ver "mis asistencias de 2025 y 2026", no se puede
- El admin tiene que volver a ingresar datos del alumno cada año
```

### 6.2 Campo `activo` Ambiguo

```
PROBLEMA:
- Alumno.activo = True significa "el registro está habilitado"
- NO significa "está tomando clases ahora"
- Un alumno puede tener activo=True pero ninguna matrícula activa

CONFUSIÓN:
- "¿Juan está activo?" → "Sí" (registro habilitado)
- "¿Juan está tomando clases?" → "No" (todas sus matrículas concluidas)
```

### 6.3 Sin Separación Activo vs Histórico

```
PROBLEMA:
- No hay forma de ver "todos los alumnos que alguna vez estuvieron"
- No hay forma de ver "solo alumnos actuales"
- El admin ve TODO mezclado

NECESIDAD:
- Vista "Alumnos Activos": matrícula con sesiones > 0
- Vista "Histórico": matrículas concluidas
- Filtro por fecha: "alumnos de enero 2026"
```

### 6.4 Sin Alerta de Sesiones Agotadas

```
PROBLEMA:
- Cuando un alumno agota sus sesiones, DESAPARECE de asistencias
- No hay notificación automática
- No hay reporte de "quién concluyó esta semana"

NECESIDAD:
- Dashboard: "3 alumnos concluyeron esta semana"
- Filtro: "Mostrar por concluir (≤3 clases)"
- Notificación automática cuando falten 2-3 clases
```

### 6.5 Sin Historial de Culminaciones

```
PROBLEMA:
- No hay log de "quién culminó y cuándo"
- No se puede hacer seguimiento post-culminación
- No se puede saber "alumnos que concluyeron en mayo"

NECESIDAD:
- Tabla de historial: alumno, fecha_culminacion, horario, sesiones
- Reporte: "Culminaciones del mes"
- Acción: "Enviar recordatorio de renovación"
```

### 6.6 UI/UX Mejorable

```
PROBLEMA:
- Matrículas muestran datos muy crudos cuando hay muchos registros
- No hay acceso rápido desde Asistencias a Matrícula
- No hay búsqueda por nombre/DNI rápida
- No hay botón de falta masiva

NECESIDAD:
- Búsqueda por texto en Matrículas
- Click en alumno → ver detalle de matrícula
- Botón "Marcar todos asistió/falta"
- Filtros combinados: "Guitarra + Lunes + Activo"
```

---

## 7. Features que Faltan

### 7.1 Vista de Alumnos por Horario

```
COMO DOCENTE QUIERO:
- Ver qué alumnos tengo en "Guitarra - Lunes 10:00"
- Ver asistencias de CADA alumno en ese horario
- Filtrar: alumnos activos vs históricos

CÓMO ESTÁ AHORA:
- El docente ve TODOS los alumnos del ciclo en "Mis Alumnos"
- No puede filtrar por horario específico
- Mezcla alumnos de diferentes talleres
```

### 7.2 Separación Activo vs Histórico

```
COMO ADMIN QUIERO:
- Ver solo alumnos con matrícula activa (default)
- Poder buscar alumnos históricos cuando necesito
- No cargar el backend con datos innecesarios

CÓMO ESTÁ AHORA:
- Se muestra todo junto
- No hay distinción clara
```

### 7.3 Alerta de Sesiones Agotadas

```
COMO ADMIN QUIERO:
- Saber qué alumnos concluyeron sus sesiones hoy/semana
- Poder avisar a las familias para renovar
- Tener un reporte de culminaciones

CÓMO ESTÁ AHORA:
- No hay alerta
- El alumno desaparece silenciosamente
```

### 7.4 Botón de Falta Masiva

```
COMO PROFESOR QUIERO:
- Marcar "todos asistieron" de una vez
- O "todos faltaron" de una vez
- Y luego corregir las excepciones

CÓMO ESTÁ AHORA:
- Marcar uno por uno (lento si hay muchos alumnos)
```

### 7.5 Filtros Mejorados en Matrículas

```
COMO ADMIN QUIERO:
- Búsqueda por nombre o DNI
- Filtros combinados: taller + día + hora + estado
- Ordenar por fecha, nombre, precio

CÓMO ESTÁ AHORA:
- Filtros básicos (taller, día, hora, estado)
- Sin búsqueda por texto
- Sin ordenamiento personalizado
```

### 7.6 Acceso Rápido desde Asistencias

```
COMO PROFESOR QUIERO:
- Click en alumno en Asistencias → ver su matrícula
- Ver cuántas sesiones le quedan
- Ver datos de contacto

CÓMO ESTÁ AHORA:
- Tengo que ir a Matrículas → buscar el alumno
- Se pierde el contexto
```

### 7.7 Historial de Culminaciones

```
COMO ADMIN QUIERO:
- Ver log de culminaciones: quién, cuándo, en qué horario
- Reporte: "alumnos que concluyeron este mes"
- Acción: "enviar recordatorio de renovación"

CÓMO ESTÁ AHORA:
- No hay historial
- No hay forma de hacer seguimiento
```

### 7.8 Portal de Alumno (NO EXISTE)

```
COMO ALUMNO QUIERO:
- Ver mis asistencias
- Ver cuántas sesiones me quedan
- Ver mis recibos de pago
- Renovar mi matrícula

CÓMO ESTÁ AHORA:
- No hay portal de alumno
- Todo lo hace el admin manualmente
```

### 7.9 Notificaciones (NO EXISTE)

```
COMO ADMIN QUIERO:
- Recibir alerta cuando un alumno esté por concluir
- Enviar WhatsApp automático a la familia
- Recordatorios de pago pendiente

CÓMO ESTÁ AHORA:
- No hay notificaciones
- Todo es manual
```

---

## 8. API Endpoints

### 8.1 Autenticación

```
POST   /api/auth/login/                    → Token JWT
POST   /api/auth/refresh/                  → Refrescar token
POST   /api/auth/logout/                   → Blacklist token
```

### 8.2 CRUD (Router DRF)

```
GET/POST        /api/ciclos/                    → Listar/Crear ciclos
GET/PUT/PATCH/DELETE /api/ciclos/{id}/          → Detalle/Editar/Borrar

GET/POST        /api/alumnos/                   → Listar/Crear alumnos
GET/PUT/PATCH/DELETE /api/alumnos/{id}/         → Detalle/Editar/Borrar

GET/POST        /api/profesores/                → Listar/Crear profesores
GET/PUT/PATCH/DELETE /api/profesores/{id}/      → Detalle/Editar/Borrar

GET/POST        /api/talleres/                  → Listar/Crear talleres
GET/PUT/PATCH/DELETE /api/talleres/{id}/        → Detalle/Editar/Borrar

GET/POST        /api/horarios/                  → Listar/Crear horarios
GET/PUT/PATCH/DELETE /api/horarios/{id}/        → Detalle/Editar/Borrar

GET/POST        /api/matriculas/                → Listar/Crear matrículas
GET/PUT/PATCH/DELETE /api/matriculas/{id}/      → Detalle/Editar/Borrar

GET/POST        /api/asistencias/               → Listar/Crear asistencias
GET/PUT/PATCH/DELETE /api/asistencias/{id}/     → Detalle/Editar/Borrar

GET/POST        /api/recibos/                   → Listar/Crear recibos
GET/PUT/PATCH/DELETE /api/recibos/{id}/         → Detalle/Editar/Borrar

GET/POST        /api/precios/                   → Listar/Crear precios
GET/PUT/PATCH/DELETE /api/precios/{id}/         → Detalle/Editar/Borrar

GET/POST        /api/egresos/                   → Listar/Crear egresos
GET/PUT/PATCH/DELETE /api/egresos/{id}/         → Detalle/Editar/Borrar

GET/POST        /api/pagos-profesores/          → Listar/Crear pagos
GET/PUT/PATCH/DELETE /api/pagos-profesores/{id}/→ Detalle/Editar/Borrar
```

### 8.3 Acciones Personalizadas

```
PATCH   /api/config/                                → Ciclo activo
POST    /api/pagos-profesores/calcular-periodo/     → Calcular pago profesor
GET     /api/pagos-profesores/detalle-clase/        → Detalle por clase

GET     /api/ciclos/{id}/resumen/                   → Resumen del ciclo
GET     /api/ciclos/{id}/resumen-mensual/           → Resumen mensual
GET     /api/ciclos/{id}/dashboard/                 → KPIs del dashboard
GET     /api/ciclos/{id}/alumnos/                   → Alumnos del ciclo
GET     /api/ciclos/{id}/talleres/                  → Talleres del ciclo
GET     /api/ciclos/{id}/profesores/                → Profesores del ciclo
GET     /api/ciclos/{id}/horarios/                  → Horarios del ciclo
GET     /api/ciclos/{id}/matriculas/                → Matrículas del ciclo
GET     /api/ciclos/{id}/asistencias/               → Asistencias del ciclo
GET     /api/ciclos/{id}/asistencias/por-horario/   → Asistencias filtradas
GET     /api/ciclos/{id}/asistencias/recuperables/  → Recuperaciones
GET     /api/ciclos/{id}/recibos/                   → Recibos del ciclo
GET     /api/ciclos/{id}/precios/                   → Precios del ciclo
GET     /api/ciclos/{id}/egresos/                   → Egresos del ciclo
```

### 8.4 Portal Docente

```
POST    /api/portal/docente/login/                  → Login docente
POST    /api/portal/docente/auth/refresh/           → Refrescar token
GET     /api/portal/docente/me/                     → Perfil del docente
GET     /api/portal/docente/ciclos/                 → Ciclos del docente
GET     /api/portal/docente/alumnos/                → Alumnos del docente
GET     /api/portal/docente/horarios/               → Horarios del docente
GET     /api/portal/docente/asistencias/            → Asistencias del docente
GET     /api/portal/docente/alumnos/{id}/asistencias/ → Asistencias por alumno
```

---

## Documentos Relacionados

- `docs/01-v2-design-decisions.md` — Decisiones de diseño para v2
- `docs/02-complete-system-specification.md` — Especificación completa del sistema v2
- `AGENTS.md` — Documentación técnica del proyecto
