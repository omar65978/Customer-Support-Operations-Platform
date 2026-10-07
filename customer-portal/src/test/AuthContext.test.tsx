import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
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

function TestConsumer() {
  const { user, isLoading, login, logout } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (user) {
    return (
      <div>
        <span data-testid="user-name">{user.name}</span>
        <span data-testid="user-role">{user.role}</span>
        <button onClick={logout}>Sign out</button>
      </div>
    );
  }
  return <button onClick={() => login({ email: 'alice@example.com', password: 'password123' })}>Sign in</button>;
}

const customerSession = {
  id: 'u1',
  email: 'alice@example.com',
  name: 'Alice Johnson',
  role: 'customer' as const,
  accessToken: 'test-jwt-token',
  refreshToken: 'test-refresh-token',
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it('initializes with no user when no session token exists', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(authApi.restoreSession).not.toHaveBeenCalled();
  });

  it('revalidates the stored token and role with Supabase before restoring a session', async () => {
    localStorage.setItem('user', JSON.stringify({ ...customerSession, role: 'manager' }));
    localStorage.setItem('token', customerSession.accessToken);
    vi.mocked(authApi.restoreSession).mockResolvedValueOnce(customerSession);

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('Alice Johnson'));
    expect(screen.getByTestId('user-role')).toHaveTextContent('customer');
    expect(localStorage.getItem('user')).toContain('"role":"customer"');
  });

  it('sets user state and both session tokens after successful login', async () => {
    const session = { ...customerSession, accessToken: 'new-token', refreshToken: 'new-refresh-token' };
    vi.mocked(authApi.login).mockResolvedValueOnce(session);

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('Alice Johnson'));
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
  });

  it('clears local session state on logout', async () => {
    localStorage.setItem('user', JSON.stringify(customerSession));
    localStorage.setItem('token', customerSession.accessToken);
    vi.mocked(authApi.restoreSession).mockResolvedValueOnce(customerSession);

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user-name')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('clears an unverified session instead of trusting its cached role', async () => {
    localStorage.setItem('user', JSON.stringify({ ...customerSession, role: 'customer' }));
    localStorage.setItem('token', customerSession.accessToken);
    vi.mocked(authApi.restoreSession).mockRejectedValueOnce(new Error('Profile lookup failed'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
  });
});
