import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  restoreSession: vi.fn(),
  refreshAuthSession: vi.fn(),
  saveAuthSession: (authUser: { id: string; email: string; name: string; role: string; accessToken: string; refreshToken: string }) => {
    localStorage.setItem('token', authUser.accessToken);
    localStorage.setItem('refresh_token', authUser.refreshToken);
    localStorage.setItem('user', JSON.stringify({ id: authUser.id, email: authUser.email, name: authUser.name, role: authUser.role }));
  },
  clearAuthSession: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },
  revokeAuthSession: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  fetchMyRequests: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 5 }),
  fetchRequest: vi.fn().mockResolvedValue(null),
  createRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
}));

vi.mock('../api/messages', () => ({
  fetchMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
}));

const verifiedCustomer = {
  id: 'u1',
  email: 'alice@example.com',
  name: 'Alice Johnson',
  role: 'customer' as const,
  accessToken: 'valid-token',
  refreshToken: 'refresh-token',
};

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

describe('Protected Routes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it('redirects a sessionless visitor from /dashboard to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders protected content only after Supabase confirms the customer session', async () => {
    localStorage.setItem('user', JSON.stringify({ ...verifiedCustomer, role: 'manager' }));
    localStorage.setItem('token', verifiedCustomer.accessToken);
    vi.mocked(authApi.restoreSession).mockResolvedValueOnce(verifiedCustomer);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard Content</div></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Dashboard Content')).toBeInTheDocument());
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(localStorage.getItem('user')).toContain('"role":"customer"');
  });

  it('redirects a verified customer away from /login to /dashboard', async () => {
    localStorage.setItem('user', JSON.stringify(verifiedCustomer));
    localStorage.setItem('token', verifiedCustomer.accessToken);
    vi.mocked(authApi.restoreSession).mockResolvedValueOnce(verifiedCustomer);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><div>Login Page</div></PublicRoute>} />
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Dashboard Content')).toBeInTheDocument());
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
