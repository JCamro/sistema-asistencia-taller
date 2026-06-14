import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores/authStore';
import PortalLayout from '../../components/layout/PortalLayout';

/* ------------------------------------------------------------------ */
/*  Mock API calls (no top-level references to avoid hoisting issues)  */
/* ------------------------------------------------------------------ */

vi.mock('../../api/portalDocente', () => ({
  getMe: vi.fn().mockResolvedValue({
    id: 1,
    nombre: 'Carlos',
    apellido: 'López',
    dni: '12345678',
    email: 'carlos@test.com',
    telefono: '999888777',
  }),
  getCiclos: vi.fn().mockResolvedValue([{ id: 1, nombre: '2026-I' }]),
  logoutApi: vi.fn(),
  getAlumnosCartilla: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('PortalLayout', () => {
  beforeEach(() => {
    // Ensure user is authenticated
    useAuthStore.setState({
      accessToken: 'fake-access-token',
      user: null,
      cicloActual: null,
    });
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Cargando portal...')).toBeInTheDocument();
  });

  it('fetches profile and cycles on mount', async () => {
    const portalDocente = await import('../../api/portalDocente');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(portalDocente.getMe).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(portalDocente.getCiclos).toHaveBeenCalledTimes(1);
    });
  });

  it('renders Sidebar and Header after loading', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Cargando portal...')).not.toBeInTheDocument();
    });

    // Sidebar should be present
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Horarios')).toBeInTheDocument();

    // Header should show user info
    expect(screen.getByText('CL')).toBeInTheDocument();
  });

  it('renders Outlet content after loading', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });

  it('returns null when not authenticated', () => {
    useAuthStore.setState({ accessToken: null });

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(container.innerHTML).toBe('');
  });
});
