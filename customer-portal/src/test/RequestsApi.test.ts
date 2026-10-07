import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, fetchMyRequests, fetchRequest, updateRequestStatus } from '../api/requests';
import type { NewRequestPayload } from '../types';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    defaults: { baseURL: 'https://support.test/rest/v1' },
  },
}));

const payload: NewRequestPayload = {
  title: 'Cannot access my account',
  description: 'The reset link does not work and I cannot sign in.',
  category: 'account',
  priority: 'high',
};

describe('customer request API', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
  });

  it('creates a request without trusting browser-supplied owner, assignment, or lifecycle fields', async () => {
    const { default: client } = await import('../api/axios') as unknown as { default: { post: ReturnType<typeof vi.fn> } };
    client.post.mockResolvedValueOnce({ data: [{
      id: 'r1', reference: 'REQ-ABC123', customer_id: 'u1', assigned_agent_id: null,
      title: payload.title, description: payload.description, category: 'account', priority: 'high',
      status: 'open', created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z', resolved_at: null,
    }] });

    const request = await createRequest(payload);

    expect(request.customerId).toBe('u1');
    expect(client.post).toHaveBeenCalledWith('/requests', payload, expect.anything());
    const body = client.post.mock.calls[0][1];
    expect(body.customer_id).toBeUndefined();
    expect(body.assigned_agent_id).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(body.reference).toBeUndefined();
    expect(body.created_at).toBeUndefined();
  });

  it('uses customer filtering and bounded server-side pagination', async () => {
    const { default: client } = await import('../api/axios') as unknown as { default: { get: ReturnType<typeof vi.fn> } };
    client.get.mockResolvedValueOnce({
      data: [],
      headers: { 'content-range': '10-19/45' },
    });

    const page = await fetchMyRequests({ status: 'open' }, 2, 10, 'customer-id');

    expect(page.total).toBe(45);
    expect(page.page).toBe(2);
    expect(client.get).toHaveBeenCalledWith(expect.stringContaining('customer_id=eq.customer-id'), expect.objectContaining({
      headers: expect.objectContaining({ Range: '10-19', Prefer: 'count=exact' }),
    }));
  });

  it('treats an RLS-filtered detail response as unavailable', async () => {
    const { default: client } = await import('../api/axios') as unknown as { default: { get: ReturnType<typeof vi.fn> } };
    client.get.mockResolvedValueOnce({ data: [] });
    await expect(fetchRequest('not-owned')).rejects.toThrow('not found or access denied');
  });

  it('sends only the status transition and lets the database set timestamps', async () => {
    const { default: client } = await import('../api/axios') as unknown as { default: { patch: ReturnType<typeof vi.fn> } };
    client.patch.mockResolvedValueOnce({ data: [{
      id: 'r1', reference: 'REQ-ABC123', customer_id: 'u1', assigned_agent_id: null,
      title: payload.title, description: payload.description, category: 'account', priority: 'high',
      status: 'in_progress', created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T01:00:00Z', resolved_at: null,
    }] });

    await updateRequestStatus('r1', 'in_progress');

    expect(client.patch).toHaveBeenCalledWith('/requests', { status: 'in_progress' }, expect.objectContaining({
      params: { id: 'eq.r1' },
    }));
  });
});
