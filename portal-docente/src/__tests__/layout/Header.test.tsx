import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import Header from '../../components/layout/Header';

/* ------------------------------------------------------------------ */
/*  Mock the logoutApi module                                          */
/* ------------------------------------------------------------------ */

vi.mock('../../api/portalDocente', () => ({
  logoutApi: vi.fn(),
  getAlumnosCartilla: vi.fn(),
  getMe: vi.fn(),
  getCiclos: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const mockUser = {
  id: 1,
  nombre: 'Carlos',
  apellido: 'López',
  dni: '12345678',
  email: 'carlos@test.com',
  telefono: '999888777',
};

const mockCicloActual = { id: 1, nombre: '2026-I' };

const mockCiclos = [
  { id: 1, nombre: '2026-I' },
  { id: 2, nombre: '2026-II' },
];

function renderHeader(
  ciclos = mockCiclos,
  sidebarAbierto = false,
  onToggleSidebar = vi.fn()
) {
  return render(
    <MemoryRouter>
      <Header
        ciclos={ciclos}
        sidebarAbierto={sidebarAbierto}
        onToggleSidebar={onToggleSidebar}
      />
    </MemoryRouter>
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Header', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: mockUser,
      cicloActual: mockCicloActual,
      refreshToken: 'fake-refresh-token',
      accessToken: 'fake-access-token',
    });
  });

  it('shows user initials in avatar', () => {
    renderHeader();

    // Initials: CL (Carlos López)
    expect(screen.getByText('CL')).toBeInTheDocument();
  });

  it('shows user full name', () => {
    renderHeader();

    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  it('shows current cycle in the dropdown button', () => {
    renderHeader();

    expect(screen.getByText('2026-I')).toBeInTheDocument();
  });

  it('opens cycle dropdown when clicked', () => {
    renderHeader();

    const cycleButton = screen.getByText('2026-I').closest('button')!;
    fireEvent.click(cycleButton);

    // Both cycles should appear in dropdown
    expect(screen.getByText('2026-II')).toBeInTheDocument();
  });

  it('calls onToggleSidebar when hamburger is clicked', () => {
    const onToggle = vi.fn();
    renderHeader(mockCiclos, false, onToggle);

    // Find hamburger button
    const hamburger = document.querySelector('.pd-hamburger-btn')!;
    fireEvent.click(hamburger);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows logout button', () => {
    renderHeader();

    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });
});
