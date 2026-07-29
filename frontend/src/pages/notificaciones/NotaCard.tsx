import { memo, useState } from 'react';
import { BellIcon, NoteIcon, CheckCircleIcon, EditIcon, TrashIcon } from './icons';
import { formatDateShort } from './date-helpers';
import { type Nota } from '../../api/endpoints';

interface NotaCardProps {
  nota: Nota;
  onEdit: (n: Nota) => void;
  onDelete: (n: Nota) => void;
  onToggleRead: (n: Nota) => void;
}

const NotaCard = memo(function NotaCard({ nota, onEdit, onDelete, onToggleRead }: NotaCardProps) {
  const [hovered, setHovered] = useState(false);
  const esRecordatorio = nota.es_recordatorio;
  const unread = esRecordatorio && !nota.leida;
  const leido = esRecordatorio && nota.leida;

  // Expired: recordatorio vencido y no leído
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
  const vencido = esRecordatorio && !leido && nota.fecha_vencimiento && nota.fecha_vencimiento < today;

  // Colors: vencido = rojo, no leído = amarillo, leído = sutil, nota = neutro
  const bg = vencido ? '#fef2f2' : unread ? '#fffbeb' : leido ? '#fafafa' : 'white';
  const borderClr = vencido ? '#fecaca' : unread ? '#fde68a' : '#f1f5f9';
  const borderLeftClr = vencido ? '#dc2626' : unread ? '#d4af37' : 'transparent';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bg,
        border: '1px solid',
        borderColor: borderClr,
        borderLeft: `${unread ? '3px' : '3px'} solid ${borderLeftClr}`,
        borderRadius: '10px',
        padding: '0.85rem 1rem',
        transition: 'box-shadow 0.15s, border-color 0.15s, background 0.15s',
        boxShadow: hovered
          ? '0 4px 20px rgba(0,0,0,0.06)'
          : vencido
            ? '0 1px 4px rgba(220,38,38,0.1)'
            : unread
              ? '0 1px 4px rgba(212,175,55,0.1)'
              : '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      {/* Top: icon + title + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
        {/* Type icon */}
        <div style={{
          width: 28, height: 28, borderRadius: '8px',
          background: vencido ? '#fecaca' : unread ? '#fde68a' : esRecordatorio ? '#fef3c7' : '#f3f4f6',
          color: vencido ? '#991b1b' : unread ? '#92400e' : esRecordatorio ? '#92400e' : '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {esRecordatorio ? <BellIcon size={14} /> : <NoteIcon size={14} />}
        </div>

        {/* Title */}
        <span style={{
          fontWeight: (unread || vencido) ? 700 : 500,
          fontSize: '0.9375rem',
          color: vencido ? '#991b1b' : unread ? '#92400e' : '#111827',
          flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
        }}>
          {nota.titulo}
        </span>

        {/* Type badge */}
        <span style={{
          padding: '0.15rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          background: vencido ? '#fecaca' : esRecordatorio ? '#fef3c7' : '#f3f4f6',
          color: vencido ? '#991b1b' : esRecordatorio ? '#92400e' : '#6b7280',
          flexShrink: 0,
        }}>
          {vencido ? 'VENCIDO' : esRecordatorio ? 'RECORDATORIO' : 'NOTA'}
        </span>
      </div>

      {/* Content preview — preserves line breaks, lists, spacing */}
      {nota.contenido && (
        <div style={{
          margin: '0.25rem 0 0.4rem 2.15rem',
          fontSize: '0.8125rem',
          color: '#6b7280',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {nota.contenido}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem', marginLeft: '2.15rem' }}>
        {/* Date info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: '#9ca3af' }}>
          <span>{formatDateShort(nota.fecha)}</span>
          {nota.es_recordatorio && nota.fecha_vencimiento && (
            <>
              <span style={{ color: '#d1d5db' }}>|</span>
              {leido ? (
                <span style={{
                  padding: '0.1rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  background: '#ecfdf5',
                  color: '#047857',
                }}>
                  Leído {formatDateShort(nota.updated_at)}
                </span>
              ) : vencido ? (
                <span style={{
                  padding: '0.1rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  background: '#fecaca',
                  color: '#991b1b',
                }}>
                  Venció {formatDateShort(nota.fecha_vencimiento)}
                </span>
              ) : (
                <span style={{
                  padding: '0.1rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  background: '#fef3c7',
                  color: '#92400e',
                }}>
                  Vence {formatDateShort(nota.fecha_vencimiento)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {/* Mark read — ONE TIME ONLY for unread recordatorios */}
          {esRecordatorio && unread && (
            <button
              onClick={() => onToggleRead(nota)}
              title="Marcar como leída"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: '#d4af37',
                color: 'white',
              }}
            >
              <CheckCircleIcon size={13} />
              Marcar leída
            </button>
          )}

          {/* Edit + Delete — hover only */}
          <div style={{ display: 'flex', gap: '0.2rem', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            <button
              onClick={() => onEdit(nota)}
              title="Editar"
              style={{ width: 26, height: 26, borderRadius: '7px', border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <EditIcon />
            </button>
            <button
              onClick={() => onDelete(nota)}
              title="Eliminar"
              style={{ width: 26, height: 26, borderRadius: '7px', border: 'none', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export { NotaCard };
export type { NotaCardProps };
