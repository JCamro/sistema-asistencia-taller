# Mis Pagos — Portal Docente (Egresos)

## Context

The current `Mis Pagos` page shows `PagoProfesor` records (calculated payment summaries per period). The user wants to change this to show **actual expenses** (`Egreso` model) created in the teacher's name (`tipo='pago_profesor'`). This gives teachers visibility into what they've actually been paid, not just calculated hours.

## Goal

Replace the current `PagoProfesor`-based pagos page with an `Egreso`-based page that shows:
- List of payments (egresos) made to the teacher
- Basic statistics (total paid, count, average, last payment)
- Date range filter
- Modal detail view for each payment

## Approach

Reuse the existing `Egreso` model (no schema changes). Create a new portal endpoint that filters egresos by `tipo='pago_profesor'` and `profesor=current_user`.

---

## Backend

### New endpoint

`GET /api/portal-docente/ciclos/{ciclo_id}/pagos/`

Replaces the current `PagoProfesor`-based endpoint.

**Query params:**
- `fecha_desde` (YYYY-MM-DD, optional)
- `fecha_hasta` (YYYY-MM-DD, optional)

**Response:**
```json
{
  "pagos": [...],
  "stats": {
    "total_pagado": 1250.00,
    "cantidad_pagos": 8,
    "promedio_pago": 156.25,
    "ultimo_pago": "2026-07-15"
  }
}
```

### Serializer: `EgresoPortalSerializer`

```python
class EgresoPortalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Egreso
        fields = ['id', 'monto', 'descripcion', 'fecha', 'metodo_pago',
                  'estado', 'beneficiario', 'created_at']
        read_only_fields = fields
```

### Query logic

```python
profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

qs = Egreso.objects.filter(
    ciclo_id=ciclo_id,
    profesor_id=profesor_id,
    tipo='pago_profesor',
)

if fecha_desde:
    qs = qs.filter(fecha__gte=fecha_desde)
if fecha_hasta:
    qs = qs.filter(fecha__lte=fecha_hasta)

qs = qs.order_by('-fecha')
```

### Stats computation

```python
from django.db.models import Sum, Count, Avg, Max

stats = qs.aggregate(
    total_pagado=Sum('monto', filter=Q(estado='cancelado')),
    cantidad_pagos=Count('id'),
    promedio_pago=Avg('monto', filter=Q(estado='cancelado')),
    ultimo_pago=Max('fecha', filter=Q(estado='cancelado')),
)
```

### URL registration

Add to `core/urls.py` portal section:
```python
path('portal-docente/ciclos/<int:ciclo_id>/pagos/', ProfesorPagosView.as_view()),
```

---

## Frontend

### Types

```typescript
interface EgresoPortal {
  id: number;
  monto: number;
  descripcion: string;
  fecha: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'yape' | 'plin';
  estado: 'pendiente' | 'cancelado';
  beneficiario: string;
  created_at: string;
}

interface PagosStats {
  total_pagado: number;
  cantidad_pagos: number;
  promedio_pago: number;
  ultimo_pago: string | null;
}

interface PagosResponse {
  pagos: EgresoPortal[];
  stats: PagosStats;
}
```

### API function

```typescript
export const getPagos = async (
  cicloId: number,
  params?: { fecha_desde?: string; fecha_hasta?: string }
): Promise<PagosResponse> => { ... }
```

### PagosPage layout

```
┌─────────────────────────────────────────────┐
│ Mis Pagos                          [8 pagos]│
├─────────────────────────────────────────────┤
│ [Fecha desde] [Fecha hasta]                 │
├─────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────┐│
│ │Total    │ │Cantidad │ │Promedio │ │Últ.││
│ │S/. 1250 │ │8 pagos  │ │S/. 156  │ │15/7││
│ └─────────┘ └─────────┘ └─────────┘ └────┘│
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 15 jul 2026          S/. 200.00        │ │
│ │ Transferencia · Cancelado              │ │
│ │ Pago por clases de guitarra            │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 01 jul 2026          S/. 150.00        │ │
│ │ Efectivo · Cancelado                   │ │
│ │ Pago quincena junio                    │ │
│ └─────────────────────────────────────────┘ │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Modal de detalle

```
┌─────────────────────────────────────┐
│ Detalle del pago              [X]   │
├─────────────────────────────────────┤
│ Fecha            15 jul 2026       │
│ Monto            S/. 200.00        │
│ Método de pago   Transferencia     │
│ Estado           Cancelado         │
│ Descripción      Pago por clases   │
│                  de guitarra       │
│ Beneficiario     Juan Pérez        │
│ Registrado       15 jul 2026 10:30 │
├─────────────────────────────────────┤
│            [Cerrar]                │
└─────────────────────────────────────┘
```

### Component structure

```
PagosPage.tsx
├── Header (title + count)
├── FilterBar (fecha_desde, fecha_hasta date pickers)
├── StatsRow (4 SummaryCards)
├── PagosList (cards with onClick → modal)
│   └── PagoCard (fecha, monto, método, estado, descripción)
└── PagoDetailModal (full detail)
```

### Style tokens

- Monto destacado: `color: var(--color-gold)`, `fontFamily: var(--font-heading)`
- Estado badges: reuse `ESTADO_PAGO_MAP` for pendiente/cancelado
- Método de pago: icon + text (efectivo 💵, transferencia 🏦, yape 📱, plin 📱)
- Cards: `var(--color-surface)`, `border: 1px solid var(--color-border)`, `borderRadius: var(--radius-xl)`

---

## Files to change

### Backend
- `core/views/portal_docente/pagos_view.py` — rewrite `ProfesorPagosView`
- `core/serializers/portal_docente/serializers.py` — add `EgresoPortalSerializer`

### Frontend
- `src/pages/PagosPage.tsx` — full rewrite
- `src/api/portalDocente.ts` — update `getPagos` return type
- `src/types/index.ts` — add `EgresoPortal`, `PagosStats`, `PagosResponse`

---

## Edge cases

- **No pagos for ciclo:** Show EmptyState "No hay pagos registrados"
- **All pagos pendientes:** Stats show 0 for total_pagado and promedio
- **Date filter with no results:** Show EmptyState "No hay pagos en este rango"
- **Modal scroll:** Modal should be scrollable on mobile if content overflows

## Out of scope

- Changing the Egreso model (no migration needed)
- Changing the admin Egresos page
- PagoProfesor model (kept for admin use, just not shown in portal)
- Charts or graphs (basic stats only per user choice)
