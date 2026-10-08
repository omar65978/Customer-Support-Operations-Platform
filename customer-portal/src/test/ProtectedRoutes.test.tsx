import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

vi.mock('../api/requests', async () => {
  const actual = await vi.importActual<typeof import('../api/requests')>('../api/requests');
  return {
    ...actual,
    fetchMyRequests: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 5 }),
    fetchRequest: vi.fn().mockRejectedValue(new Error('not visible')),
    createRequest: vi.fn(),
    reopenRequest: vi.fn(),
  };
});

vi.mock('../api/messages', () => ({
  fetchMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
}));

vi.mock('../api/attachments', async () => {
  const actual = await vi.importActual<typeof import('../api/attachments')>('../api/attachments');
  return { ...actual, fetchAttachments: vi.fn().mockResolvedValue([]) };
});

const CUSTOMER = { id: 'c1', email: 'alice@example.com', name: 'Alice Johnson', role: 'customer' };

function signIn(user: object) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'test-token');
}

describe('route protection (real App routes)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('sends a signed-out visitor from /dashboard to the sign-in page', async () => {
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('lets a customer into the dashboard', async () => {
    signIn(CUSTOMER);
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'My Support Requests' })).toBeInTheDocument();
  });

  it('does not let a stored staff session into the customer portal', async () => {
    signIn({ ...CUSTOMER, id: 'a1', role: 'agent' });
    window.history.pushState({}, '', '/dashboard');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('shows a clear error when a request cannot be loaded (no access or not found)', async () => {
    signIn(CUSTOMER);
    window.history.pushState({}, '', '/requests/someone-elses-request');
    render(<App />);
    expect(await screen.findByText('Failed to load this request. Please try again.')).toBeInTheDocument();
  });

  it('sends unknown addresses to the dashboard', async () => {
    signIn(CUSTOMER);
    window.history.pushState({}, '', '/no-such-page');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'My Support Requests' })).toBeInTheDocument();
  });
});
