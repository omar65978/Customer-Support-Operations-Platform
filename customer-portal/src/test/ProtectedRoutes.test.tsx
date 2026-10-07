import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

vi.mock('../api/requests', () => ({
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchRequest: vi.fn().mockResolvedValue(null),
  createRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
}));

vi.mock('../api/messages', () => ({
  fetchMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
}));

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
  });

  it('redirects unauthenticated user from /dashboard to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders protected content for authenticated user', async () => {
    const stored = { id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'customer' };
    localStorage.setItem('user', JSON.stringify(stored));
    localStorage.setItem('token', 'valid-token');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects authenticated user away from /login to /dashboard', async () => {
    const stored = { id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'customer' };
    localStorage.setItem('user', JSON.stringify(stored));
    localStorage.setItem('token', 'valid-token');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <div>Login Page</div>
                </PublicRoute>
              }
            />
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
