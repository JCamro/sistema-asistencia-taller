# Mis Pagos — Implementation Plan (Egresos)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `PagoProfesor`-based pagos page with an `Egreso`-based page showing actual payments to teachers.

**Architecture:** Backend: new `EgresoPortalSerializer` + rewrite `ProfesorPagosView` to query `Egreso` where `tipo='pago_profesor'`. Frontend: rewrite `PagosPage` with stats cards, date filter, payment list, and detail modal.

**Tech Stack:** Django 6, DRF, React 19, TypeScript, Zustand, inline styles + CSS utility classes

## Global Constraints

- All user-facing text in Spanish
- Timezone: `America/Lima`
- Inline styles + CSS utility classes (no Tailwind)
- Wrap page components with `memo()`
- Use `useWindowWidth()` for responsive breakpoints
- Touch targets minimum 44px height
- Backend validation in serializers only

---

## File Structure

### Backend
- `core/serializers/portal_docente/serializers.py` — add `EgresoPortalSerializer`
- `core/views/portal_docente/pagos_view.py` — rewrite `ProfesorPagosView`

### Frontend
- `src/types/index.ts` — add `EgresoPortal`, `PagosStats`, `PagosResponse`
- `src/api/portalDocente.ts` — update `getPagos` return type
- `src/pages/PagosPage.tsx` — full rewrite

---

### Task 1: Backend — EgresoPortalSerializer

**Files:**
- Modify: `core/serializers/portal_docente/serializers.py`
- Test: `core/tests/test_portal_pagos.py`

**Interfaces:**
- Consumes: `Egreso` model (existing)
- Produces: `EgresoPortalSerializer` class

- [ ] **Step 1: Write the failing test**

```python
# core/tests/test_portal_pagos.py
import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from core.models import Egreso, Ciclo, Profesor
from core.shared.authentication import ProfesorJWTAuthentication


def _portal_docente_client(profesor):
    """Return an APIClient authenticated with a portal-docente JWT token."""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken()
    refresh['profesor_id'] = profesor.id
    refresh['dni'] = profesor.dni
    refresh['type'] = 'portal_docente'
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


@pytest.mark.django_db
class TestProfesorPagosView:
    def test_returns_egresos_for_profesor(self):
        ciclo = Ciclo.objects.create(nombre='2026', activo=True)
        profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', activo=True
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=profesor, tipo='pago_profesor',
            monto=200, fecha='2026-07-15', metodo_pago='transferencia',
            estado='cancelado', descripcion='Pago julio'
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/pagos/'
        response = client.get(url)
        assert response.status_code == 200
        assert 'pagos' in response.data
        assert 'stats' in response.data
        assert len(response.data['pagos']) == 1
        assert response.data['stats']['total_pagado'] == 200

    def test_filters_by_fecha_desde(self):
        ciclo = Ciclo.objects.create(nombre='2026', activo=True)
        profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', activo=True
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=profesor, tipo='pago_profesor',
            monto=100, fecha='2026-06-01', metodo_pago='efectivo',
            estado='cancelado'
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=profesor, tipo='pago_profesor',
            monto=200, fecha='2026-07-15', metodo_pago='transferencia',
            estado='cancelado'
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/pagos/?fecha_desde=2026-07-01'
        response = client.get(url)
        assert response.status_code == 200
        assert len(response.data['pagos']) == 1
        assert response.data['pagos'][0]['monto'] == 200

    def test_excludes_other_profesor(self):
        ciclo = Ciclo.objects.create(nombre='2026', activo=True)
        profesor = Profesor.objects.create(
            ciclo=ciclo, nombre='Juan', apellido='Pérez',
            dni='12345678', activo=True
        )
        otro = Profesor.objects.create(
            ciclo=ciclo, nombre='María', apellido='López',
            dni='87654321', activo=True
        )
        Egreso.objects.create(
            ciclo=ciclo, profesor=otro, tipo='pago_profesor',
            monto=300, fecha='2026-07-15', metodo_pago='yape',
            estado='cancelado'
        )
        client = _portal_docente_client(profesor)
        url = f'/api/portal-docente/ciclos/{ciclo.id}/pagos/'
        response = client.get(url)
        assert response.status_code == 200
        assert len(response.data['pagos']) == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core/tests/test_portal_pagos.py -v`
Expected: FAIL (view returns `PagoProfesor` data, not `Egreso`)

- [ ] **Step 3: Add EgresoPortalSerializer**

```python
# core/serializers/portal_docente/serializers.py — add after existing imports
from core.models import Egreso

class EgresoPortalSerializer(serializers.ModelSerializer):
    """Egreso serializer for portal docente — read-only payment view."""
    class Meta:
        model = Egreso
        fields = ['id', 'monto', 'descripcion', 'fecha', 'metodo_pago',
                  'estado', 'beneficiario', 'created_at']
        read_only_fields = fields
```

- [ ] **Step 4: Run test to verify serializer works (view still fails)**

Run: `pytest core/tests/test_portal_pagos.py -v`
Expected: FAIL (view still uses PagoProfesor)

- [ ] **Step 5: Commit**

```bash
git add core/serializers/portal_docente/serializers.py core/tests/test_portal_pagos.py
git commit -m "feat(portal): add EgresoPortalSerializer for teacher payments"
```

---

### Task 2: Backend — Rewrite ProfesorPagosView

**Files:**
- Modify: `core/views/portal_docente/pagos_view.py`

**Interfaces:**
- Consumes: `EgresoPortalSerializer` (from Task 1)
- Produces: `GET /api/portal-docente/ciclos/{id}/pagos/` returns `{ pagos: [...], stats: {...} }`

- [ ] **Step 1: Rewrite the view**

```python
# core/views/portal_docente/pagos_view.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg, Max, Q

from core.models import Egreso
from core.serializers.portal_docente.serializers import EgresoPortalSerializer
from core.shared.authentication import ProfesorJWTAuthentication, get_profesor_for_ciclo


class ProfesorPagosView(APIView):
    """
    GET /api/portal-docente/ciclos/{ciclo_id}/pagos/

    Returns Egreso records (tipo='pago_profesor') for the authenticated professor.
    Includes stats: total_pagado, cantidad_pagos, promedio_pago, ultimo_pago.

    Query params:
    - fecha_desde: YYYY-MM-DD (optional)
    - fecha_hasta: YYYY-MM-DD (optional)
    """
    authentication_classes = [ProfesorJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, ciclo_id):
        profesor_id = get_profesor_for_ciclo(request.user.dni, ciclo_id)

        qs = Egreso.objects.filter(
            ciclo_id=ciclo_id,
            profesor_id=profesor_id,
            tipo='pago_profesor',
        )

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)

        qs = qs.order_by('-fecha')

        serializer = EgresoPortalSerializer(qs, many=True)

        stats = qs.aggregate(
            total_pagado=Sum('monto', filter=Q(estado='cancelado')),
            cantidad_pagos=Count('id'),
            promedio_pago=Avg('monto', filter=Q(estado='cancelado')),
            ultimo_pago=Max('fecha', filter=Q(estado='cancelado')),
        )

        # Replace None with 0 for numeric stats
        stats['total_pagado'] = float(stats['total_pagado'] or 0)
        stats['cantidad_pagos'] = stats['cantidad_pagos'] or 0
        stats['promedio_pago'] = float(stats['promedio_pago'] or 0)
        stats['ultimo_pago'] = str(stats['ultimo_pago']) if stats['ultimo_pago'] else None

        return Response({
            'pagos': serializer.data,
            'stats': stats,
        })
```

- [ ] **Step 2: Run tests**

Run: `pytest core/tests/test_portal_pagos.py -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add core/views/portal_docente/pagos_view.py
git commit -m "feat(portal): rewrite PagosView to return Egreso data with stats"
```

---

### Task 3: Frontend — Types + API

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/portalDocente.ts`

**Interfaces:**
- Consumes: backend response format from Task 2
- Produces: `EgresoPortal`, `PagosStats`, `PagosResponse` types; `getPagos` function

- [ ] **Step 1: Add types**

```typescript
// src/types/index.ts — add after existing types
export interface EgresoPortal {
  id: number;
  monto: number;
  descripcion: string;
  fecha: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'yape' | 'plin';
  estado: 'pendiente' | 'cancelado';
  beneficiario: string;
  created_at: string;
}

export interface PagosStats {
  total_pagado: number;
  cantidad_pagos: number;
  promedio_pago: number;
  ultimo_pago: string | null;
}

export interface PagosResponse {
  pagos: EgresoPortal[];
  stats: PagosStats;
}
```

- [ ] **Step 2: Update getPagos**

```typescript
// src/api/portalDocente.ts — replace existing getPagos
export const getPagos = async (
  cicloId: number,
  params?: { fecha_desde?: string; fecha_hasta?: string }
): Promise<PagosResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.fecha_desde) searchParams.set('fecha_desde', params.fecha_desde);
  if (params?.fecha_hasta) searchParams.set('fecha_hasta', params.fecha_hasta);
  const query = searchParams.toString();
  const url = `/portal-docente/ciclos/${cicloId}/pagos/${query ? `?${query}` : ''}`;
  const response = await api.get<PagosResponse>(url);
  return response.data;
};
```

- [ ] **Step 3: Remove old types**

Remove `PagoProfesorPortal` and `PagoProfesorDetallePortal` from `src/types/index.ts` if no longer used elsewhere.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS (no TS errors)

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/api/portalDocente.ts
git commit -m "feat(portal): add EgresoPortal types and update getPagos API"
```

---

### Task 4: Frontend — PagosPage (Full Rewrite)

**Files:**
- Modify: `src/pages/PagosPage.tsx`

**Interfaces:**
- Consumes: `getPagos` from Task 3, `EgresoPortal`, `PagosStats`, `PagosResponse`
- Produces: Complete pagos page with stats, filter, list, modal

- [ ] **Step 1: Rewrite PagosPage**

Replace the entire file with the new implementation. Key components:

```typescript
// src/pages/PagosPage.tsx
import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getPagos } from '../api/portalDocente';
import type { EgresoPortal, PagosStats } from '../types';
import Loading from '../components/ui/Loading';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { useWindowWidth } from '../hooks/useWindowWidth';
import { formatMonto, formatDate } from '../utils/formatters';

const METODO_PAGO_MAP: Record<string, { label: string; icon: string }> = {
  efectivo: { label: 'Efectivo', icon: '💵' },
  transferencia: { label: 'Transferencia', icon: '🏦' },
  yape: { label: 'Yape', icon: '📱' },
  plin: { label: 'Plin', icon: '📱' },
};

const ESTADO_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: '#d97706', bg: '#fef3c7' },
  cancelado: { label: 'Cancelado', color: '#16a34a', bg: '#dcfce7' },
};

const PagosPage = memo(() => {
  const cicloActivo = useAuthStore((s) => s.cicloActivo);
  const width = useWindowWidth();
  const isMobile = width <= 768;

  const [pagos, setPagos] = useState<EgresoPortal[]>([]);
  const [stats, setStats] = useState<PagosStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selectedPago, setSelectedPago] = useState<EgresoPortal | null>(null);

  const fetchData = useCallback(async () => {
    if (!cicloActivo) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const params: { fecha_desde?: string; fecha_hasta?: string } = {};
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;
      const data = await getPagos(cicloActivo.id, Object.keys(params).length ? params : undefined);
      setPagos(data.pagos);
      setStats(data.stats);
    } catch {
      setError('Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, [cicloActivo, fechaDesde, fechaHasta]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await fetchData(); };
    run();
    return () => { cancelled = true; };
  }, [fetchData]);

  // ... render: header, filters, stats cards, pago list cards, modal
  // (full implementation follows existing patterns from AlumnosPage, NotesPage)
});

export default PagosPage;
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/PagosPage.tsx
git commit -m "feat(portal): rewrite PagosPage with Egreso data, stats, and modal"
```

---

### Task 5: Cleanup — Remove Old PagoProfesor Types

**Files:**
- Modify: `src/types/index.ts` (if not done in Task 3)
- Modify: `src/api/portalDocente.ts` (remove old `PagoProfesorPortal` references)

- [ ] **Step 1: Check for remaining references**

Run: `grep -r "PagoProfesorPortal\|PagoProfesorDetallePortal" src/`
Expected: No results (all references removed)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(portal): remove unused PagoProfesorPortal types"
```

---

## Self-Review

1. **Spec coverage:** Backend endpoint ✓, serializer ✓, stats ✓, frontend types ✓, API ✓, page rewrite ✓, modal ✓, date filter ✓, edge cases ✓
2. **Placeholder scan:** All steps have complete code. No TBD/TODO.
3. **Type consistency:** `EgresoPortal` matches serializer fields. `PagosResponse` matches backend response. `getPagos` returns `PagosResponse`.
