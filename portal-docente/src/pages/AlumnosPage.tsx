import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getAlumnosCartilla } from '../api/portalDocente';
import { DIAS_SEMANA } from '../utils/constants';
import type { AlumnoCartilla, HorarioBadge } from '../types';

/* ------------------------------------------------------------------ */
/*  Helper: unique talleres extracted from the students' horarios     */
/* ------------------------------------------------------------------ */
function extractTalleres(alumnos: AlumnoCartilla[]): { id: number; nombre: string }[] {
  const seen = new Map<number, string>();
  for (const a of alumnos) {
    for (const h of a.horarios) {
      if (!seen.has(h.taller_id)) {
        seen.set(h.taller_id, h.taller_nombre);
      }
    }
  }
  return Array.from(seen.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function formatHorario(h: HorarioBadge): string {
  const dia = DIAS_SEMANA[h.dia_semana] ?? '?';
  const inicio = h.hora_inicio.slice(0, 5);
  const fin = h.hora_fin.slice(0, 5);
  return `${dia} ${inicio}-${fin}`;
}

const HorarioBadge = memo(function HorarioBadge({ horario }: { horario: HorarioBadge }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.25rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 500,
        color: '#1e40af',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        whiteSpace: 'nowrap',
      }}
      title={horario.taller_nombre}
    >
      {horario.taller_nombre}
      <span style={{ color: '#64748b', fontWeight: 400 }}>—</span>
      {formatHorario(horario)}
    </span>
  );
});

const StudentCard = memo(function StudentCard({ alumno }: { alumno: AlumnoCartilla }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {alumno.nombre.charAt(0).toUpperCase()}
          {alumno.apellido.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              color: '#1e293b',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {alumno.apellido}, {alumno.nombre}
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: '#64748b',
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            {alumno.dni && <span>DNI: {alumno.dni}</span>}
            {alumno.telefono && <span>📞 {alumno.telefono}</span>}
          </div>
        </div>
      </div>

      {/* Horario badges */}
      {alumno.horarios.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.375rem',
          }}
        >
          {alumno.horarios.map((h) => (
            <HorarioBadge key={h.id} horario={h} />
          ))}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const AlumnosPage = memo(function AlumnosPage() {
  const cicloActual = useAuthStore((s) => s.cicloActual);

  const [alumnos, setAlumnos] = useState<AlumnoCartilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTallerId, setSelectedTallerId] = useState<number | null>(null);

  // Ref for cancellation flag
  const fetchIdRef = useRef(0);

  /* ---- Debounced search (300 ms) ---- */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  /* ---- Fetch ---- */
  const fetchAlumnos = useCallback(async () => {
    if (!cicloActual) return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    try {
      const data = await getAlumnosCartilla(cicloActual.id, {
        search: debouncedSearch || undefined,
        taller_id: selectedTallerId ?? undefined,
      });
      // Only apply if this is the latest request
      if (id === fetchIdRef.current) {
        setAlumnos(data);
      }
    } catch {
      if (id === fetchIdRef.current) {
        setAlumnos([]);
      }
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [cicloActual, debouncedSearch, selectedTallerId]);

  useEffect(() => {
    fetchAlumnos();
  }, [fetchAlumnos]);

  /* ---- Derived: unique talleres for dropdown ---- */
  const talleres = useMemo(() => extractTalleres(alumnos), [alumnos]);

  /* ---- Empty state flag ---- */
  const isEmpty = !loading && alumnos.length === 0;

  /* ---- Styles ---- */
  const styles = {
    container: {
      maxWidth: '960px',
      margin: '0 auto',
      padding: '1.5rem 1rem',
    } as React.CSSProperties,
    header: {
      marginBottom: '1.5rem',
    } as React.CSSProperties,
    title: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#1e293b',
      marginBottom: '0.25rem',
    } as React.CSSProperties,
    subtitle: {
      fontSize: '0.875rem',
      color: '#64748b',
    } as React.CSSProperties,
    filters: {
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '1.25rem',
      flexWrap: 'wrap' as const,
    },
    input: {
      flex: 1,
      minWidth: '200px',
      padding: '0.625rem 0.875rem',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontSize: '0.875rem',
      outline: 'none',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      minHeight: '44px',
    } as React.CSSProperties,
    select: {
      padding: '0.625rem 2rem 0.625rem 0.875rem',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      fontSize: '0.875rem',
      outline: 'none',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      cursor: 'pointer',
      appearance: 'none' as const,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 0.75rem center',
      minWidth: '180px',
      minHeight: '44px',
    } as React.CSSProperties,
    grid: {
      display: 'grid',
      gap: '0.75rem',
    } as React.CSSProperties,
    empty: {
      textAlign: 'center' as const,
      padding: '3rem 1rem',
      color: '#94a3b8',
      fontSize: '0.9375rem',
    } as React.CSSProperties,
    loading: {
      display: 'flex',
      justifyContent: 'center',
      padding: '3rem 0',
    } as React.CSSProperties,
    spinner: {
      width: '32px',
      height: '32px',
      border: '3px solid #e2e8f0',
      borderTop: '3px solid #3b82f6',
      borderRadius: '50%',
      animation: 'pd-spin 0.7s linear infinite',
    } as React.CSSProperties,
  };

  return (
    <div style={styles.container}>
      {/* Inject spinner keyframes + responsive grid */}
      <style>{`
        @keyframes pd-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .alumnos-grid { grid-template-columns: 1fr; }
        @media (min-width: 769px) {
          .alumnos-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Cartilla de Alumnos</h1>
        <p style={styles.subtitle}>
          {cicloActual ? `Ciclo: ${cicloActual.nombre}` : 'Seleccioná un ciclo para comenzar'}
        </p>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.input}
          className="touch-target"
          aria-label="Buscar alumnos por nombre o DNI"
        />
        <select
          value={selectedTallerId ?? ''}
          onChange={(e) => setSelectedTallerId(e.target.value ? Number(e.target.value) : null)}
          style={styles.select}
          className="touch-target"
          aria-label="Filtrar por taller"
        >
          <option value="">Todos</option>
          {talleres.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={styles.loading}>
          <div style={styles.spinner} />
        </div>
      ) : isEmpty ? (
        <div style={styles.empty}>
          No se encontraron alumnos para los filtros seleccionados
        </div>
      ) : (
        <div className="alumnos-grid" style={styles.grid}>
          {alumnos.map((a) => (
            <StudentCard key={a.id} alumno={a} />
          ))}
        </div>
      )}
    </div>
  );
});

export default AlumnosPage;
