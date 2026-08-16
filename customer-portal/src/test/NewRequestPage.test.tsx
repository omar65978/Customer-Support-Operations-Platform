import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { NewRequestPage } from '../pages/NewRequestPage';
import * as requestsApi from '../api/requests';

vi.mock('../api/requests', () => ({
  fetchMyRequests: vi.fn().mockResolvedValue([]),
  fetchRequest: vi.fn(),
  createRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderWithProviders(ui: React.ReactElement) {
  localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'customer' }));
  localStorage.setItem('token', 'test-token');
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe('NewRequestPage form validation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    vi.mocked(requestsApi.fetchMyRequests).mockResolvedValue([]);
  });

  it('shows validation error when title is empty on submit', async () => {
    renderWithProviders(<NewRequestPage />);

    const submitBtn = await screen.findByRole('button', { name: /submit request/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please provide a title/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when title is too short', async () => {
    renderWithProviders(<NewRequestPage />);

    const titleInput = await screen.findByPlaceholderText(/brief summary/i);
    await userEvent.type(titleInput, 'Hi');

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/at least 5 characters/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when description is empty on submit', async () => {
    renderWithProviders(<NewRequestPage />);

    const titleInput = await screen.findByPlaceholderText(/brief summary/i);
    await userEvent.type(titleInput, 'Valid title for request');

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please describe your issue/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when description is too short', async () => {
    renderWithProviders(<NewRequestPage />);

    const titleInput = await screen.findByPlaceholderText(/brief summary/i);
    await userEvent.type(titleInput, 'Valid title here');

    const descInput = screen.getByPlaceholderText(/describe your issue in detail/i);
    await userEvent.type(descInput, 'Too short');

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/at least 20 characters/i)).toBeInTheDocument();
    });
  });

  it('calls createRequest with correct customer ID on valid submission', async () => {
    const mockCreated = {
      id: 'r-new', reference: 'REQ-100', customerId: 'u1', assignedAgentId: null,
      title: 'Valid title for testing', description: 'This description is long enough for validation purposes.',
      category: 'general' as const, priority: 'medium' as const, status: 'open' as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resolvedAt: null,
    };
    vi.mocked(requestsApi.createRequest).mockResolvedValueOnce(mockCreated);

    renderWithProviders(<NewRequestPage />);

    await userEvent.type(await screen.findByPlaceholderText(/brief summary/i), 'Valid title for testing');
    await userEvent.type(screen.getByPlaceholderText(/describe your issue in detail/i), 'This description is long enough for validation purposes.');

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(requestsApi.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Valid title for testing' }),
        'u1'
      );
    });
  });
});
