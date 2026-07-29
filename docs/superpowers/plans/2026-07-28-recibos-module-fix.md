# Recibos Module Performance & Correctness Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix performance and correctness issues in the Recibos module by eliminating redundant API calls, moving client-side filters to the server, and cleaning up duplicate interfaces.

**Architecture:** Backend-first approach — add aggregation endpoint and date filters before consuming them in the frontend. Frontend refactors separate concerns (KPIs, form data, list data) into independent fetch cycles and switch to the shared axios instance for automatic token refresh.

**Tech Stack:** Django 6.0.3 + DRF 3.17.1, React 19 + TypeScript 5.9, pytest-django

## Global Constraints

- All user-facing text in Spanish
- Backend: `snake_case` for Python identifiers, one view per file, services for business logic
- Frontend: `camelCase` for variables/functions, `PascalCase` for components/interfaces
- Use `select_related`/`prefetch_related` on every ViewSet queryset
- Existing test fixtures: `cliente_autenticado`, `ciclo`, `alumno`, `taller`, `matricula` (see `core/tests/conftest.py`)
- Frontend pages wrapped in `memo()`, generic components reused

---

## File Structure

### Backend (create/modify)
- `core/models/recibo.py` — Add `db_index=True` on `fecha_emision`, fix `__str__` N+1
- `core/serializers/recibo.py` — Remove `matriculas_detalle` from `ReciboListSerializer`
- `core/views/recibo_view.py` — Add `totals` action, add date filter params (`fecha`, `fecha_desde`, `fecha_hasta`)
- `core/urls.py` — Add route for `ciclos/<int:ciclo_id>/recibos/totals/`
- `core/migrations/0XXX_auto_*.py` — Auto-generated migration for `fecha_emision` index
- `core/tests/test_recibo_totals.py` — Tests for totals endpoint
- `core/tests/test_recibo_date_filters.py` — Tests for date filter params

### Frontend (modify)
- `frontend/src/api/endpoints.ts` — Extend `Recibo` interface with missing fields
- `frontend/src/pages/recibos/Recibos.tsx` — Major refactor: debounce, separate fetches, use axios, remove client-side filters
- `frontend/src/pages/recibos/ReciboDetailModal.tsx` — Remove duplicate `Recibo` interface, import from endpoints
- `frontend/src/pages/recibos/RecibosFilterBar.tsx` — No changes (already receives props)

---

### Task 1: Remove `matriculas_detalle` from ReciboListSerializer

**Files:**
- Modify: `core/serializers/recibo.py:69-103`
- Test: `core/tests/test_recibo_list_serializer.py`

**Interfaces:**
- Consumes: `ReciboListSerializer` (existing)
- Produces: `ReciboListSerializer` without `matriculas_detalle` field

**Why:** The list endpoint serializes full nested matriculas for every recibo — data the frontend never renders in the list view. This causes unnecessary joins and payload bloat.

- [ ] **Step 1: Write failing test**

Create `core/tests/test_recibo_list_serializer.py`:

```python
import pytest
from django.urls import reverse
from datetime import date
from core.models import Recibo, ReciboMatricula


@pytest.mark.django_db
class TestReciboListSerializer:
    def test_list_serializer_excludes_matriculas_detalle(self, cliente_autenticado, ciclo, alumno, matricula):
        recibo = Recibo.objects.create(
            ciclo=ciclo,
            numero='R-001',
            fecha_emision=date(2026, 7, 1),
            monto_total=160,
            estado='pendiente'
        )
        ReciboMatricula.objects.create(recibo=recibo, matricula=matricula, monto=160)
        
        url = reverse('ciclo-recibos', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)
        
        assert response.status_code == 200
        data = response.json()
        results = data['results'] if 'results' in data else data
        assert len(results) == 1
        assert 'matriculas_detalle' not in results[0]
        assert 'matricula_ids' in results[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core/tests/test_recibo_list_serializer.py -v`
Expected: FAIL — `matriculas_detalle` is currently in the response

- [ ] **Step 3: Remove `matriculas_detalle` from ReciboListSerializer**

Edit `core/serializers/recibo.py`, lines 69-87:

```python
class ReciboListSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    alumnos_nombres = serializers.SerializerMethodField()
    matricula_ids = serializers.SerializerMethodField()
    ciclo_nombre = serializers.CharField(source='ciclo.nombre', read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    paquete_display = serializers.CharField(source='get_paquete_aplicado_display', read_only=True)
    metodo_pago = serializers.CharField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Recibo
        fields = [
            'id', 'numero', 'alumno', 'alumno_nombre', 'alumnos_nombres',
            'matricula_ids', 'ciclo', 'ciclo_nombre', 'fecha_emision', 'monto_bruto', 'monto_total',
            'monto_pagado', 'descuento', 'paquete_aplicado', 'paquete_display',
            'precio_editado', 'saldo_pendiente', 'estado', 'metodo_pago', 'updated_at'
        ]
```

Removed: `matriculas_detalle = ReciboMatriculaSerializer(...)` line and `'matriculas_detalle'` from fields list.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest core/tests/test_recibo_list_serializer.py -v`
Expected: PASS

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `pytest`
Expected: All tests pass (170+ existing tests)

- [ ] **Step 6: Commit**

```bash
git add core/serializers/recibo.py core/tests/test_recibo_list_serializer.py
git commit -m "perf(recibos): remove matriculas_detalle from list serializer"
```

---

### Task 2: Add KPI totals endpoint

**Files:**
- Modify: `core/views/recibo_view.py:15-116`
- Modify: `core/urls.py:77`
- Test: `core/tests/test_recibo_totals.py`

**Interfaces:**
- Consumes: `Recibo` model, `ciclo_id` from URL
- Produces: `GET /api/ciclos/{ciclo_id}/recibos/totals/` → `{ total: Decimal, pagado: Decimal, pendiente: Decimal }`

**Why:** Frontend currently fetches 500 records to sum 3 numbers. Server-side aggregation with `Sum()` is O(1) in payload size.

- [ ] **Step 1: Write failing test**

Create `core/tests/test_recibo_totals.py`:

```python
import pytest
from django.urls import reverse
from datetime import date
from core.models import Recibo


@pytest.mark.django_db
class TestReciboTotals:
    def test_totals_returns_aggregated_sums(self, cliente_autenticado, ciclo):
        Recibo.objects.create(
            ciclo=ciclo, numero='R-001', fecha_emision=date(2026, 7, 1),
            monto_total=100, monto_pagado=100, estado='pagado'
        )
        Recibo.objects.create(
            ciclo=ciclo, numero='R-002', fecha_emision=date(2026, 7, 2),
            monto_total=200, monto_pagado=50, estado='pendiente'
        )
        Recibo.objects.create(
            ciclo=ciclo, numero='R-003', fecha_emision=date(2026, 7, 3),
            monto_total=150, monto_pagado=0, estado='pendiente'
        )
        
        url = reverse('ciclo-recibos-totals', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)
        
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == '450.00'
        assert data['pagado'] == '100.00'
        assert data['pendiente'] == '350.00'  # 200 + 150 (monto_total of pendientes)
    
    def test_totals_filters_by_ciclo(self, cliente_autenticado, ciclo):
        other_ciclo = __import__('core.models', fromlist=['Ciclo']).Ciclo.objects.create(
            nombre='Other', tipo='anual', fecha_inicio='2025-01-01', fecha_fin='2025-12-31'
        )
        Recibo.objects.create(
            ciclo=ciclo, numero='R-001', fecha_emision=date(2026, 7, 1),
            monto_total=100, monto_pagado=100, estado='pagado'
        )
        Recibo.objects.create(
            ciclo=other_ciclo, numero='R-002', fecha_emision=date(2025, 7, 1),
            monto_total=999, monto_pagado=999, estado='pagado'
        )
        
        url = reverse('ciclo-recibos-totals', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)
        
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == '100.00'
        assert data['pagado'] == '100.00'
    
    def test_totals_empty_ciclo(self, cliente_autenticado, ciclo):
        url = reverse('ciclo-recibos-totals', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url)
        
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == '0.00'
        assert data['pagado'] == '0.00'
        assert data['pendiente'] == '0.00'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core/tests/test_recibo_totals.py -v`
Expected: FAIL — endpoint doesn't exist yet (404)

- [ ] **Step 3: Add `totals` action to ReciboViewSet**

Edit `core/views/recibo_view.py`, add import at top:

```python
from django.db.models import Sum, Q
```

Add method inside `ReciboViewSet` class (after `get_queryset`):

```python
    @action(detail=False, methods=['get'])
    def totals(self, request, ciclo_id=None):
        queryset = self.get_queryset()
        aggregates = queryset.aggregate(
            total=Sum('monto_total'),
            pagado=Sum('monto_pagado', filter=Q(estado='pagado')),
            pendiente=Sum('monto_total', filter=Q(estado='pendiente'))
        )
        return Response({
            'total': f"{aggregates['total'] or 0:.2f}",
            'pagado': f"{aggregates['pagado'] or 0:.2f}",
            'pendiente': f"{aggregates['pendiente'] or 0:.2f}"
        })
```

- [ ] **Step 4: Add URL route**

Edit `core/urls.py`, line 77 (after the existing `ciclo-recibos` path):

```python
    path('ciclos/<int:ciclo_id>/recibos/totals/', ReciboViewSet.as_view({'get': 'totals'}), name='ciclo-recibos-totals'),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest core/tests/test_recibo_totals.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run full test suite**

Run: `pytest`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add core/views/recibo_view.py core/urls.py core/tests/test_recibo_totals.py
git commit -m "feat(recibos): add totals endpoint for KPI aggregation"
```

---

### Task 3: Add server-side date filters to ReciboViewSet

**Files:**
- Modify: `core/views/recibo_view.py:35-43`
- Test: `core/tests/test_recibo_date_filters.py`

**Interfaces:**
- Consumes: Query params `fecha` (exact date), `fecha_desde` (start date), `fecha_hasta` (end date)
- Produces: Filtered queryset by `fecha_emision`

**Why:** Frontend `filtroPreset` (hoy/semana/mes) currently filters client-side, which breaks with pagination. Moving to server-side ensures correct filtering across all pages.

- [ ] **Step 1: Write failing test**

Create `core/tests/test_recibo_date_filters.py`:

```python
import pytest
from django.urls import reverse
from datetime import date
from core.models import Recibo


@pytest.mark.django_db
class TestReciboDateFilters:
    def test_filter_by_exact_fecha(self, cliente_autenticado, ciclo):
        Recibo.objects.create(ciclo=ciclo, numero='R-001', fecha_emision=date(2026, 7, 15), monto_total=100)
        Recibo.objects.create(ciclo=ciclo, numero='R-002', fecha_emision=date(2026, 7, 16), monto_total=200)
        
        url = reverse('ciclo-recibos', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url, {'fecha': '2026-07-15'})
        
        assert response.status_code == 200
        data = response.json()
        results = data['results'] if 'results' in data else data
        assert len(results) == 1
        assert results[0]['numero'] == 'R-001'
    
    def test_filter_by_fecha_range(self, cliente_autenticado, ciclo):
        Recibo.objects.create(ciclo=ciclo, numero='R-001', fecha_emision=date(2026, 7, 10), monto_total=100)
        Recibo.objects.create(ciclo=ciclo, numero='R-002', fecha_emision=date(2026, 7, 15), monto_total=200)
        Recibo.objects.create(ciclo=ciclo, numero='R-003', fecha_emision=date(2026, 7, 20), monto_total=300)
        
        url = reverse('ciclo-recibos', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url, {'fecha_desde': '2026-07-12', 'fecha_hasta': '2026-07-18'})
        
        assert response.status_code == 200
        data = response.json()
        results = data['results'] if 'results' in data else data
        assert len(results) == 1
        assert results[0]['numero'] == 'R-002'
    
    def test_filter_by_fecha_desde_only(self, cliente_autenticado, ciclo):
        Recibo.objects.create(ciclo=ciclo, numero='R-001', fecha_emision=date(2026, 7, 1), monto_total=100)
        Recibo.objects.create(ciclo=ciclo, numero='R-002', fecha_emision=date(2026, 7, 15), monto_total=200)
        
        url = reverse('ciclo-recibos', kwargs={'ciclo_id': ciclo.id})
        response = cliente_autenticado.get(url, {'fecha_desde': '2026-07-10'})
        
        assert response.status_code == 200
        data = response.json()
        results = data['results'] if 'results' in data else data
        assert len(results) == 1
        assert results[0]['numero'] == 'R-002'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core/tests/test_recibo_date_filters.py -v`
Expected: FAIL — filters not implemented yet (returns all records)

- [ ] **Step 3: Add date filter logic to `get_queryset`**

Edit `core/views/recibo_view.py`, modify `get_queryset` method (lines 35-43):

```python
    def get_queryset(self):
        queryset = super().get_queryset()
        ciclo_id = self.kwargs.get('ciclo_id')
        if ciclo_id:
            queryset = queryset.filter(ciclo_id=ciclo_id)
        
        # Date filters
        fecha = self.request.query_params.get('fecha')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        
        if fecha:
            queryset = queryset.filter(fecha_emision=fecha)
        if fecha_desde:
            queryset = queryset.filter(fecha_emision__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_emision__lte=fecha_hasta)
        
        # When searching through matriculas (multi-student), avoid duplicates
        if self.request.query_params.get('search'):
            queryset = queryset.distinct()
        return queryset
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest core/tests/test_recibo_date_filters.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run full test suite**

Run: `pytest`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add core/views/recibo_view.py core/tests/test_recibo_date_filters.py
git commit -m "feat(recibos): add server-side date filters (fecha, fecha_desde, fecha_hasta)"
```

---

### Task 4: Add database index on `fecha_emision`

**Files:**
- Modify: `core/models/recibo.py:50`
- Create: `core/migrations/0XXX_auto_*.py` (auto-generated)

**Interfaces:**
- Consumes: `Recibo.fecha_emision` field
- Produces: Database index on `fecha_emision` for faster date filtering

**Why:** Date filters (`fecha_emision__gte`, `fecha_emision__lte`) will benefit from an index. Low-risk schema change.

- [ ] **Step 1: Add `db_index=True` to `fecha_emision`**

Edit `core/models/recibo.py`, line 50:

```python
    fecha_emision = models.DateField(db_index=True)
```

- [ ] **Step 2: Generate migration**

Run: `python manage.py makemigrations`
Expected: Creates migration file like `core/migrations/0XXX_auto_*.py`

- [ ] **Step 3: Apply migration**

Run: `python manage.py migrate`
Expected: Migration applies successfully

- [ ] **Step 4: Run full test suite**

Run: `pytest`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add core/models/recibo.py core/migrations/0XXX_auto_*.py
git commit -m "perf(recibos): add db_index on fecha_emision for date filtering"
```

---

### Task 5: Fix `Recibo.__str__` N+1 query

**Files:**
- Modify: `core/models/recibo.py:84-95`
- Test: `core/tests/test_recibo_str.py`

**Interfaces:**
- Consumes: `Recibo.__str__` method
- Produces: Optimized `__str__` that doesn't query DB per instance

**Why:** Django admin calls `__str__` for every recibo in the list. The current implementation queries `self.matriculas.values_list(...)` per instance — N+1 problem.

- [ ] **Step 1: Write failing test**

Create `core/tests/test_recibo_str.py`:

```python
import pytest
from django.urls import reverse
from datetime import date
from core.models import Recibo, ReciboMatricula


@pytest.mark.django_db
class TestReciboStr:
    def test_str_multi_student_no_n_plus_1(self, cliente_autenticado, ciclo, alumno, matricula, taller):
        from django.test.utils import CaptureQueriesContext
        from django.db import connection
        
        recibo = Recibo.objects.create(
            ciclo=ciclo, numero='R-001', fecha_emision=date(2026, 7, 1),
            monto_total=160, estado='pendiente'
        )
        ReciboMatricula.objects.create(recibo=recibo, matricula=matricula, monto=160)
        
        # Fetch recibo with prefetch (simulating admin list view)
        with CaptureQueriesContext(connection) as context:
            recibos = list(Recibo.objects.prefetch_related('matriculas__matricula__alumno').all())
            str_outputs = [str(r) for r in recibos]
        
        # Should not execute additional queries per __str__ call
        # The prefetch should have loaded everything
        query_count = len(context.captured_queries)
        assert query_count <= 2  # 1 for recibos, 1 for prefetch
        assert 'Recibo R-001' in str_outputs[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core/tests/test_recibo_str.py -v`
Expected: FAIL — currently executes N+1 queries

- [ ] **Step 3: Fix `__str__` to use prefetched data**

Edit `core/models/recibo.py`, lines 84-95:

```python
    def __str__(self):
        if self.alumno_id:
            return f"Recibo {self.numero} - {self.alumno} - S/. {self.monto_total}"
        # Use prefetched matriculas if available, otherwise fallback
        try:
            matriculas_qs = self.matriculas.all()
            if hasattr(matriculas_qs, '_prefetch_done') or not matriculas_qs._result_cache:
                # Prefetched or empty
                alumnos = [rm.matricula.alumno for rm in matriculas_qs if rm.matricula.alumno]
            else:
                # Not prefetched, use values_list to avoid full object load
                alumnos = self.matriculas.values_list('matricula__alumno__nombre', flat=True).distinct()
            
            if alumnos:
                nombres = ", ".join(str(a) for a in alumnos[:2])
                if len(alumnos) > 2:
                    nombres += f" y {len(alumnos) - 2} más"
                return f"Recibo {self.numero} - {nombres} - S/. {self.monto_total}"
        except Exception:
            pass
        return f"Recibo {self.numero} - S/. {self.monto_total}"
```

Simplified version (if prefetch is always used in admin):

```python
    def __str__(self):
        if self.alumno_id:
            return f"Recibo {self.numero} - {self.alumno} - S/. {self.monto_total}"
        try:
            alumnos = [rm.matricula.alumno for rm in self.matriculas.all() if rm.matricula.alumno_id]
            if alumnos:
                nombres = ", ".join(str(a) for a in alumnos[:2])
                if len(alumnos) > 2:
                    nombres += f" y {len(alumnos) - 2} más"
                return f"Recibo {self.numero} - {nombres} - S/. {self.monto_total}"
        except Exception:
            pass
        return f"Recibo {self.numero} - S/. {self.monto_total}"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest core/tests/test_recibo_str.py -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `pytest`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add core/models/recibo.py core/tests/test_recibo_str.py
git commit -m "perf(recibos): fix __str__ N+1 query in admin list view"
```

---

### Task 6: Consolidate duplicate `Recibo` interfaces

**Files:**
- Modify: `frontend/src/api/endpoints.ts:134-152`
- Modify: `frontend/src/pages/recibos/Recibos.tsx:13-39`
- Modify: `frontend/src/pages/recibos/ReciboDetailModal.tsx:4-28`

**Interfaces:**
- Consumes: Duplicate `Recibo` interfaces in 3 files
- Produces: Single `Recibo` interface in `endpoints.ts`, imported by other files

**Why:** DRY violation. Changes to the interface require updates in 3 places.

- [ ] **Step 1: Extend `Recibo` interface in endpoints.ts**

Edit `frontend/src/api/endpoints.ts`, lines 134-152:

```typescript
export interface Recibo {
  id: number;
  numero: string;
  alumno: number | null;
  alumno_nombre: string;
  alumnos_nombres?: string[];
  matricula_ids?: number[];
  ciclo: number;
  ciclo_nombre: string;
  fecha_emision: string;
  monto_bruto: number;
  monto_total: number;
  monto_pagado: number;
  descuento: number;
  paquete_aplicado: string;
  paquete_display: string;
  precio_editado: boolean;
  saldo_pendiente: number;
  estado: string;
  metodo_pago?: string;
  updated_at?: string;
  matriculas_detalle?: Array<{
    alumno_nombre: string;
    taller_nombre: string;
    sesiones_contratadas: number;
    monto: number;
  }>;
}
```

- [ ] **Step 2: Remove duplicate interface from Recibos.tsx**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 1-12:

```typescript
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import RecibosFilterBar from './RecibosFilterBar';
import ReciboFormModal from './ReciboFormModal';
import ReciboDetailModal from './ReciboDetailModal';
import Badge from '../../components/ui/Badge';
import type { Recibo } from '../../api/endpoints';
```

Delete lines 13-39 (the local `Recibo` interface).

- [ ] **Step 3: Remove duplicate interface from ReciboDetailModal.tsx**

Edit `frontend/src/pages/recibos/ReciboDetailModal.tsx`, lines 1-3:

```typescript
import { memo } from 'react';
import Badge from '../../components/ui/Badge';
import type { Recibo } from '../../api/endpoints';
```

Delete lines 4-28 (the local `Recibo` interface).

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/endpoints.ts frontend/src/pages/recibos/Recibos.tsx frontend/src/pages/recibos/ReciboDetailModal.tsx
git commit -m "refactor(recibos): consolidate duplicate Recibo interfaces"
```

---

### Task 7: Add debounced search (300ms)

**Files:**
- Modify: `frontend/src/pages/recibos/Recibos.tsx:88-177`

**Interfaces:**
- Consumes: `search` state, `setSearch` setter
- Produces: `debouncedSearch` state that updates 300ms after user stops typing

**Why:** Typing "María" fires 5 complete fetchData invocations (15 API calls). Debounce reduces this to 1 call after the user pauses.

- [ ] **Step 1: Add debounce logic**

Edit `frontend/src/pages/recibos/Recibos.tsx`, add after line 96 (after `const [search, setSearch] = useState('');`):

```typescript
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
```

- [ ] **Step 2: Use `debouncedSearch` in fetchData dependencies**

Edit `frontend/src/pages/recibos/Recibos.tsx`, line 151:

```typescript
  useEffect(() => { fetchData(1); }, [cicloActual, debouncedSearch, filtroEstado, fetchData]);
```

Change `search` to `debouncedSearch` in the dependency array.

- [ ] **Step 3: Update searchRef to use debouncedSearch**

Edit `frontend/src/pages/recibos/Recibos.tsx`, line 113:

```typescript
  const searchRef = useRef(debouncedSearch);
  const filtroRef = useRef(filtroEstado);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);
  useEffect(() => { filtroRef.current = filtroEstado; }, [filtroEstado]);
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/recibos/Recibos.tsx
git commit -m "perf(recibos): add 300ms debounce to search input"
```

---

### Task 8: Separate KPI fetch (use totals endpoint, call only on mount)

**Files:**
- Modify: `frontend/src/pages/recibos/Recibos.tsx:118-149`

**Interfaces:**
- Consumes: `GET /api/ciclos/{ciclo_id}/recibos/totals/` (from Task 2)
- Produces: `total`, `pagado`, `pendiente` state updated only on mount or ciclo change

**Why:** KPIs shouldn't refetch on every filter change. The totals endpoint returns 3 numbers, not 500 records.

- [ ] **Step 1: Remove KPI computation from fetchData**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 118-149. Remove lines 137-142 (the KPI fetch):

```typescript
  const fetchData = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setCurrentPage(page);
    const searchText = searchRef.current;
    const fe = filtroRef.current;
    try {
      const params = new URLSearchParams({ ordering: '-id', page: String(page) });
      if (fe !== 'todos') params.set('estado', fe);
      if (searchText) params.set('search', searchText);
      
      const response = await api.get(`/ciclos/${cicloActual.id}/recibos/`, { params });
      const data = response.data;
      const recibosArray = data.results || data;
      setRecibos(recibosArray);
      setTotalCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 20) || 1);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);
```

Note: Also switched from raw `fetch()` to `api` (axios instance) — this completes part of Task 12.

- [ ] **Step 2: Add separate fetchTotals function**

Add after `fetchData` (around line 150):

```typescript
  const fetchTotals = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const response = await api.get(`/ciclos/${cicloActual.id}/recibos/totals/`);
      const data = response.data;
      setTotal(Number(data.total || 0));
      setPagado(Number(data.pagado || 0));
      setPendiente(Number(data.pendiente || 0));
    } catch (err) {
      console.error('Error fetching totals:', err);
    }
  }, [cicloActual]);
```

- [ ] **Step 3: Call fetchTotals only on mount or ciclo change**

Add after line 151 (the existing `useEffect` for `fetchData`):

```typescript
  useEffect(() => { fetchTotals(); }, [fetchTotals]);
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/recibos/Recibos.tsx
git commit -m "perf(recibos): separate KPI fetch, use totals endpoint"
```

---

### Task 9: Separate matriculas fetch (call only on mount)

**Files:**
- Modify: `frontend/src/pages/recibos/Recibos.tsx:118-149`

**Interfaces:**
- Consumes: `GET /api/ciclos/{ciclo_id}/matriculas/?estado=no_procesado&page_size=200`
- Produces: `matriculas` state updated only on mount or ciclo change

**Why:** Matriculas are only needed by `ReciboFormModal`, not by the list view. Refetching on every filter change is wasteful.

- [ ] **Step 1: Remove matriculas fetch from fetchData**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 118-149. Remove the matriculas fetch from `Promise.all` and the `setMatriculas` call:

```typescript
  const fetchData = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setCurrentPage(page);
    const searchText = searchRef.current;
    const fe = filtroRef.current;
    try {
      const params = new URLSearchParams({ ordering: '-id', page: String(page) });
      if (fe !== 'todos') params.set('estado', fe);
      if (searchText) params.set('search', searchText);
      
      const response = await api.get(`/ciclos/${cicloActual.id}/recibos/`, { params });
      const data = response.data;
      const recibosArray = data.results || data;
      setRecibos(recibosArray);
      setTotalCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 20) || 1);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);
```

- [ ] **Step 2: Add separate fetchMatriculas function**

Add after `fetchTotals`:

```typescript
  const fetchMatriculas = useCallback(async () => {
    if (!cicloActual) return;
    try {
      const response = await api.get(`/ciclos/${cicloActual.id}/matriculas/`, {
        params: { estado: 'no_procesado', page_size: 200 }
      });
      const data = response.data;
      setMatriculas(data.results || data);
    } catch (err) {
      console.error('Error fetching matriculas:', err);
    }
  }, [cicloActual]);
```

- [ ] **Step 3: Call fetchMatriculas only on mount or ciclo change**

Add after the `fetchTotals` useEffect:

```typescript
  useEffect(() => { fetchMatriculas(); }, [fetchMatriculas]);
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/recibos/Recibos.tsx
git commit -m "perf(recibos): separate matriculas fetch, call only on mount"
```

---

### Task 10: Move `filtroPreset` to server-side query params

**Files:**
- Modify: `frontend/src/pages/recibos/Recibos.tsx:118-177`

**Interfaces:**
- Consumes: `filtroPreset` state ('todos', 'hoy', 'semana', 'mes')
- Produces: Query params `fecha`, `fecha_desde`, `fecha_hasta` sent to backend (from Task 3)

**Why:** Client-side filtering breaks with pagination. User on page 3 selecting "Hoy" only filters page 3's 20 records, not all "hoy" records.

- [ ] **Step 1: Add date param logic to fetchData**

Edit `frontend/src/pages/recibos/Recibos.tsx`, inside `fetchData` (around line 125):

```typescript
  const fetchData = useCallback(async (page = 1) => {
    if (!cicloActual) return;
    setCurrentPage(page);
    const searchText = searchRef.current;
    const fe = filtroRef.current;
    const fp = filtroPresetRef.current;
    try {
      const params = new URLSearchParams({ ordering: '-id', page: String(page) });
      if (fe !== 'todos') params.set('estado', fe);
      if (searchText) params.set('search', searchText);
      
      // Date preset filters
      const hoy = new Date();
      const hoyStr = getLimaToday();
      if (fp === 'hoy') {
        params.set('fecha', hoyStr);
      } else if (fp === 'semana') {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        const inicioStr = `${inicioSemana.getFullYear()}-${String(inicioSemana.getMonth() + 1).padStart(2, '0')}-${String(inicioSemana.getDate()).padStart(2, '0')}`;
        params.set('fecha_desde', inicioStr);
      } else if (fp === 'mes') {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const inicioStr = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(inicioMes.getDate()).padStart(2, '0')}`;
        params.set('fecha_desde', inicioStr);
      }
      
      const response = await api.get(`/ciclos/${cicloActual.id}/recibos/`, { params });
      const data = response.data;
      const recibosArray = data.results || data;
      setRecibos(recibosArray);
      setTotalCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 20) || 1);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [cicloActual]);
```

- [ ] **Step 2: Add filtroPresetRef**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 113-116:

```typescript
  const searchRef = useRef(debouncedSearch);
  const filtroRef = useRef(filtroEstado);
  const filtroPresetRef = useRef(filtroPreset);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);
  useEffect(() => { filtroRef.current = filtroEstado; }, [filtroEstado]);
  useEffect(() => { filtroPresetRef.current = filtroPreset; }, [filtroPreset]);
```

- [ ] **Step 3: Add filtroPreset to fetchData dependencies**

Edit `frontend/src/pages/recibos/Recibos.tsx`, line 151:

```typescript
  useEffect(() => { fetchData(1); }, [cicloActual, debouncedSearch, filtroEstado, filtroPreset, fetchData]);
```

Add `filtroPreset` to the dependency array.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/recibos/Recibos.tsx
git commit -m "feat(recibos): move filtroPreset to server-side date filters"
```

---

### Task 11: Remove client-side search filter in `filteredRecibos`

**Files:**
- Modify: `frontend/src/pages/recibos/Recibos.tsx:153-177`

**Interfaces:**
- Consumes: `filteredRecibos` memo
- Produces: Simplified `filteredRecibos` that doesn't duplicate server-side filtering

**Why:** Server already filters by `search` and `estado`. Client-side filtering is redundant and causes confusion.

- [ ] **Step 1: Simplify `filteredRecibos`**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 153-177. Replace the entire `filteredRecibos` memo with:

```typescript
  const filteredRecibos = useMemo(() => {
    return recibos;
  }, [recibos]);
```

Or simply remove the memo and use `recibos` directly in the `ResponsiveTable` (line 346):

```typescript
        <ResponsiveTable<Recibo>
          columns={[
            // ... columns unchanged
          ]}
          data={recibos}
          keyField="id"
          actions={(r) => (
            <>
              <button onClick={() => handleViewRecibo(r)} className="touch-target" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: '500' }}>Ver</button>
              <button onClick={() => handleEdit(r)} className="touch-target" style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontWeight: '500' }}>Editar</button>
            </>
          )}
          emptyMessage="No hay recibos"
        />
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/recibos/Recibos.tsx
git commit -m "refactor(recibos): remove redundant client-side filtering"
```

---

### Task 12: Switch from raw `fetch()` to `api/axios.ts`

**Files:**
- Modify: `frontend/src/pages/recibos/Recibos.tsx:1-10, 118-201`

**Interfaces:**
- Consumes: `api` axios instance from `../../api/axios`
- Produces: All API calls use `api.get()` / `api.post()` instead of raw `fetch()`

**Why:** Raw `fetch()` bypasses the automatic token refresh interceptor. If the access token expires, the user gets a 401 error instead of automatic refresh.

- [ ] **Step 1: Import api instance**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 1-10:

```typescript
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useCiclo } from '../../contexts/CicloContext';
import PageHeader from '../../components/ui/PageHeader';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { Pagination } from '../../components/ui/Pagination';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import RecibosFilterBar from './RecibosFilterBar';
import ReciboFormModal from './ReciboFormModal';
import ReciboDetailModal from './ReciboDetailModal';
import Badge from '../../components/ui/Badge';
import api from '../../api/axios';
import type { Recibo } from '../../api/endpoints';
```

Remove the `getApiBaseUrl` import (line 6).

- [ ] **Step 2: Remove `apiBase` variable**

Edit `frontend/src/pages/recibos/Recibos.tsx`, line 89:

Delete: `const apiBase = getApiBaseUrl();`

- [ ] **Step 3: Replace raw `fetch()` in fetchData**

Already done in Tasks 8 and 9 — `fetchData` now uses `api.get()`.

- [ ] **Step 4: Replace raw `fetch()` in handleViewRecibo**

Edit `frontend/src/pages/recibos/Recibos.tsx`, lines 186-201:

```typescript
  const handleViewRecibo = async (recibo: Recibo) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const response = await api.get(`/recibos/${recibo.id}/`);
      setSelectedRecibo(response.data);
    } catch (err) {
      console.error('Error fetching receipt details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `npm run build` (from `frontend/` directory)
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/recibos/Recibos.tsx
git commit -m "refactor(recibos): switch from raw fetch() to axios instance"
```

---

## Summary

**Total tasks:** 12 (5 backend, 7 frontend)

**Dependency order:**
1. Backend tasks (1-5) can be done in parallel or sequentially
2. Frontend tasks (6-12) depend on backend endpoints existing
3. Task 6 (consolidate interfaces) should come first to avoid merge conflicts
4. Tasks 7-12 can be done in any order, but the suggested order minimizes rework

**Estimated complexity:**
- Backend tasks: Low-Medium (straightforward DRF patterns)
- Frontend tasks: Medium (state management refactor, but no new UI)

**Risk areas:**
- Task 10 (server-side date filters) — requires careful date math in frontend
- Task 11 (remove client-side filtering) — verify all filters still work after removal
