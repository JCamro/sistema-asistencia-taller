import { useState, useEffect, memo } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';

const ESTADOS = [
  { value: 'asistio', label: 'Asistió', color: '#059669', bg: '#d1fae5' },
  { value: 'falta', label: 'Falta', color: '#d97706', bg: '#fef3c7' },
  { value: 'falta_grave', label: 'Falta Grave', color: '#dc2626', bg: '#fee2e2' },
];

interface Asistencia {
  id: number;
  matricula: number | null;
  alumno_id: number | null;
  alumno_nombre: string;
  horario: number;
  taller_nombre: string;
  profesor: number | null;
  profesor_nombre: string;
  fecha: string;
  hora: string;
  estado: string;
  observacion: string;
  es_recuperacion: boolean;
  activo: boolean;
}

interface ProfesorOption {
  id: number;
  nombre: string;
  apellido: string;
}

interface AsistenciaEditModalProps {
  isOpen: boolean;
  asistencia: Asistencia | null;
  profesores: ProfesorOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (asistencia: Asistencia) => void | Promise<void>;
}

function AsistenciaEditModal({ isOpen, asistencia, profesores, saving, onClose, onSave }: AsistenciaEditModalProps) {
  const [draft, setDraft] = useState<Asistencia | null>(null);
  const [profesorOriginal, setProfesorOriginal] = useState<number | null>(null);
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);

  useEffect(() => {
    if (isOpen && asistencia) {
      setDraft({ ...asistencia });
      setProfesorOriginal(asistencia.profesor ?? null);
      setShowConfirm1(false);
      setShowConfirm2(false);
    } else {
      setDraft(null);
      setProfesorOriginal(null);
      setShowConfirm1(false);
      setShowConfirm2(false);
    }
  }, [isOpen, asistencia]);

  if (!isOpen || !draft) return null;

  const handleSave = () => {
    if (draft.profesor !== profesorOriginal && profesorOriginal !== null) {
      setShowConfirm1(true);
    } else {
      onSave(draft);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Editar Asistencia</h3>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{draft.alumno_nombre}</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{draft.fecha} {draft.hora?.substring(0, 5)}</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Docente</label>
            <select
              value={draft.profesor || ''}
              onChange={(e) => setDraft({ ...draft, profesor: e.target.value ? parseInt(e.target.value) : null })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem' }}
            >
              <option value="">Seleccionar docente</option>
              {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Estado</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {ESTADOS.map((estado) => (
                <button
                  key={estado.value}
                  onClick={() => setDraft({ ...draft, estado: estado.value })}
                  style={{
                    flex: 1,
                    padding: '0.75rem 0.5rem',
                    minHeight: '44px',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    background: draft.estado === estado.value ? estado.color : '#f3f4f6',
                    color: draft.estado === estado.value ? 'white' : '#374151',
                  }}
                >
                  {estado.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>Observación</label>
            <textarea
              value={draft.observacion}
              onChange={(e) => setDraft({ ...draft, observacion: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', minHeight: '48px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '0.75rem', minHeight: '48px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {showConfirm1 && (
        <ConfirmModal
          isOpen={showConfirm1}
          title="Cambiar Docente"
          message={`¿Está seguro que desea cambiar el docente de esta asistencia de "${asistencia?.profesor_nombre}"?`}
          confirmLabel="Sí, cambiar"
          cancelLabel="Cancelar"
          onConfirm={() => { setShowConfirm1(false); setShowConfirm2(true); }}
          onCancel={() => {
            setShowConfirm1(false);
            setDraft((prev) => (prev ? { ...prev, profesor: profesorOriginal } : null));
          }}
        />
      )}

      {showConfirm2 && (
        <ConfirmModal
          isOpen={showConfirm2}
          title="Confirmar Cambio de Docente"
          message="Esta acción modificará el registro de asistencia. ¿Está completamente seguro?"
          confirmLabel="Sí, confirmar cambio"
          cancelLabel="Volver"
          onConfirm={() => { setShowConfirm2(false); onSave(draft); }}
          onCancel={() => {
            setShowConfirm2(false);
            setShowConfirm1(true);
          }}
        />
      )}
    </>
  );
}

export default memo(AsistenciaEditModal);
