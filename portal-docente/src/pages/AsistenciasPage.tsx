import { memo, useState, useEffect, useCallback } from 'react';
import type { HorarioCalendario } from '../types';
import { useAuthStore } from '../stores/authStore';
import { getHorarios, getCiclos } from '../api/portalDocente';
import type { CicloBasic } from '../api/portalDocente';
import FilterBar from './asistencias/FilterBar';
import type { FilterState } from './asistencias/FilterBar';
import Level1DayOverview from './asistencias/Level1DayOverview';
import Level2TallerSessions from './asistencias/Level2TallerSessions';
import Level3StudentAttendance from './asistencias/Level3StudentAttendance';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Level = 1 | 2 | 3;

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1.5rem',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '1rem',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#64748b',
  },
  error: {
    textAlign: 'center',
    padding: '3rem',
    color: '#ef4444',
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AsistenciasPage = memo(function AsistenciasPage() {
  const authCicloActual = useAuthStore((s) => s.cicloActual);
  const cicloId = authCicloActual?.id ?? null;

  // Filter state
  const today = new Date();
  const todayDayOfWeek = ((today.getDay() + 6) % 7); // Convert JS Sunday=0 to Monday=0
  const [filter, setFilter] = useState<FilterState>({
    diaSemana: todayDayOfWeek,
    tallerId: null,
    horaInicio: null,
  });

  // Horarios cache
  const [horarios, setHorarios] = useState<HorarioCalendario[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cicloDetalle, setCicloDetalle] = useState<CicloBasic | null>(null);

  // Level 3 direct navigation state
  const [level3Target, setLevel3Target] = useState<{
    horarioId: number;
    fecha: string;
  } | null>(null);

  // Derived level
  const level: Level = filter.horaInicio != null && level3Target != null
    ? 3
    : filter.tallerId != null && filter.horaInicio != null
      ? 3
      : filter.tallerId != null
        ? 2
        : 1;

  // Fetch ciclo details (to get fecha_inicio / fecha_fin)
  useEffect(() => {
    if (!cicloId) return;
    const fetchCiclo = async () => {
      try {
        const ciclos = await getCiclos();
        const found = ciclos.find((c) => c.id === cicloId) ?? null;
        setCicloDetalle(found);
      } catch {
        // Silently fail
      }
    };
    fetchCiclo();
  }, [cicloId]);

  // Fetch horarios
  const fetchHorarios = useCallback(async () => {
    if (!cicloId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getHorarios(cicloId);
      setHorarios(data);
    } catch {
      setFetchError('Error al cargar horarios');
    } finally {
      setLoading(false);
    }
  }, [cicloId]);

  useEffect(() => {
    fetchHorarios();
  }, [fetchHorarios]);

  // Filter horarios by selected día
  const filteredHorarios = horarios.filter(
    (h) => h.dia_semana === filter.diaSemana
  );

  // Filter horarios for Level 2
  const tallerHorarios = filter.tallerId != null
    ? filteredHorarios.filter((h) => h.taller_id === filter.tallerId)
    : filteredHorarios;

  // Handlers
  const handleFilterChange = useCallback((newFilter: FilterState) => {
    setFilter(newFilter);
    setLevel3Target(null);
  }, []);

  const handleHorarioClick = useCallback(
    (horarioId: number, tallerId: number, horaInicio: string) => {
      setFilter((prev) => ({
        ...prev,
        tallerId,
        horaInicio,
      }));
      const todayStr = new Date().toISOString().slice(0, 10);
      setLevel3Target({ horarioId, fecha: todayStr });
    },
    []
  );

  const handleSessionClick = useCallback(
    (horarioId: number, fecha: string) => {
      setLevel3Target({ horarioId, fecha });
    },
    []
  );

  const handleLevel3Back = useCallback(() => {
    setLevel3Target(null);
  }, []);

  const handleLevel2Back = useCallback(() => {
    setFilter((prev) => ({ ...prev, tallerId: null }));
  }, []);

  if (!cicloId) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Selecciona un ciclo para continuar.</div>
      </div>
    );
  }

  if (loading && horarios.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Cargando horarios...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{fetchError}</div>
      </div>
    );
  }

  const cicloInicio = cicloDetalle?.fecha_inicio ?? '';
  const cicloFin = cicloDetalle?.fecha_fin ?? '';

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Asistencias</h2>

      {/* Filter bar — always visible */}
      <FilterBar
        filter={filter}
        horarios={filteredHorarios}
        onFilterChange={handleFilterChange}
      />

      {/* Level content */}
      {level === 1 && (
        <Level1DayOverview
          key={`l1-${filter.diaSemana}`}
          cicloId={cicloId}
          diaSemana={filter.diaSemana}
          horarios={filteredHorarios}
          onHorarioClick={handleHorarioClick}
        />
      )}

      {level === 2 && (
        <Level2TallerSessions
          key={`l2-${filter.tallerId}`}
          cicloId={cicloId}
          diaSemana={filter.diaSemana}
          horarios={tallerHorarios}
          cicloInicio={cicloInicio}
          cicloFin={cicloFin}
          onSessionClick={handleSessionClick}
          onBack={handleLevel2Back}
        />
      )}

      {level === 3 && (
        <Level3StudentAttendance
          key={`l3-${level3Target?.horarioId}-${level3Target?.fecha}`}
          cicloId={cicloId}
          horarioId={level3Target?.horarioId ?? (filter.tallerId ?? 0)}
          fecha={level3Target?.fecha ?? ''}
          diaSemana={filter.diaSemana}
          onBack={handleLevel3Back}
        />
      )}
    </div>
  );
});

export default AsistenciasPage;
