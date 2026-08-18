import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as authApi from '../api/auth';

vi.mock('../api/auth');

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
  return (
    <button onClick={() => login({ email: 'alice@example.com', password: 'password123' })}>
      Sign in
    </button>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it('initializes with no user when localStorage is empty', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('restores authenticated user from localStorage on mount', async () => {
    const stored = { id: 'u1', email: 'alice@example.com', name: 'Alice Johnson', role: 'customer' };
    localStorage.setItem('user', JSON.stringify(stored));
    localStorage.setItem('token', 'test-jwt-token');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user-name')).toBeInTheDocument());
    expect(screen.getByTestId('user-name')).toHaveTextContent('Alice Johnson');
    expect(screen.getByTestId('user-role')).toHaveTextContent('customer');
  });

  it('sets user state and localStorage after successful login with nested user response', async () => {
    const mockUser = {
      id: 'u1', email: 'alice@example.com', name: 'Alice Johnson',
      role: 'customer' as const, accessToken: 'new-token',
    };
    vi.mocked(authApi.login).mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByTestId('user-name')).toHaveTextContent('Alice Johnson'));
    expect(screen.getByTestId('user-role')).toHaveTextContent('customer');
    expect(localStorage.getItem('token')).toBe('new-token');
  });

  it('clears user state and localStorage after logout', async () => {
    const stored = { id: 'u1', email: 'alice@example.com', name: 'Alice Johnson', role: 'customer' };
    localStorage.setItem('user', JSON.stringify(stored));
    localStorage.setItem('token', 'test-jwt-token');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('user-name')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem('user', 'invalid-json{{{');
    localStorage.setItem('token', 'some-token');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
