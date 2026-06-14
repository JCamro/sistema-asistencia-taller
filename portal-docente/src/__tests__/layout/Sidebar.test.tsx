import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from '../../components/layout/Sidebar';

/* ------------------------------------------------------------------ */
/*  Helper: render sidebar inside MemoryRouter                         */
/* ------------------------------------------------------------------ */

function renderSidebar(
  initialRoute = '/dashboard',
  abierto = false,
  onToggle = vi.fn()
) {
  return {
    onToggle,
    ...render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Sidebar abierto={abierto} onToggle={onToggle} />
      </MemoryRouter>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Sidebar', () => {
  it('renders all 7 navigation items', () => {
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Horarios')).toBeInTheDocument();
    expect(screen.getByText('Asistencias')).toBeInTheDocument();
    expect(screen.getByText('Alumnos')).toBeInTheDocument();
    expect(screen.getByText('Notas')).toBeInTheDocument();
    expect(screen.getByText('Horas Trabajadas')).toBeInTheDocument();
    expect(screen.getByText('Pagos')).toBeInTheDocument();
  });

  it('highlights the active route with blue color', () => {
    renderSidebar('/alumnos');

    const alumnosLink = screen.getByText('Alumnos').closest('a');
    expect(alumnosLink).toHaveStyle('color: #3b82f6');

    // Non-active items should be gray
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveStyle('color: #64748b');
  });

  it('shows overlay when sidebar is open', () => {
    renderSidebar('/dashboard', true);

    // Overlay should be present
    const overlay = document.querySelector('.pd-sidebar-overlay');
    expect(overlay).toBeInTheDocument();
  });

  it('does not show overlay when sidebar is closed', () => {
    renderSidebar('/dashboard', false);

    const overlay = document.querySelector('.pd-sidebar-overlay');
    expect(overlay).not.toBeInTheDocument();
  });

  it('calls onToggle when overlay is clicked', () => {
    const { onToggle } = renderSidebar('/dashboard', true);

    const overlay = document.querySelector('.pd-sidebar-overlay')!;
    fireEvent.click(overlay);

    // onToggle should be called (closes sidebar)
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
