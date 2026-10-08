import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCustomerRequestParams,
  createRequest,
  DEFAULT_REQUEST_FILTERS,
  fetchMyRequests,
  fetchRequest,
  reopenRequest,
  sanitizeSearch,
  type RequestFilters,
} from '../api/requests';
import { ConflictError, NotFoundError } from '../api/errors';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

type MockClient = { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

async function client(): Promise<MockClient> {
  return ((await import('../api/axios')) as unknown as { default: MockClient }).default;
}

const withFilters = (patch: Partial<RequestFilters>): RequestFilters => ({ ...DEFAULT_REQUEST_FILTERS, ...patch });

describe('customer request queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('always scopes the list to the signed-in customer', () => {
    const params = buildCustomerRequestParams(DEFAULT_REQUEST_FILTERS, 'cust-1');
    expect(params.get('customer_id')).toBe('eq.cust-1');
  });

  it('maps lifecycle groups to the matching statuses on the server', () => {
    expect(buildCustomerRequestParams(withFilters({ group: 'active' }), 'c').get('status')).toBe('in.(open,in_progress)');
    expect(buildCustomerRequestParams(withFilters({ group: 'waiting' }), 'c').get('status')).toBe('in.(waiting_for_customer)');
    expect(buildCustomerRequestParams(withFilters({ group: 'completed' }), 'c').get('status')).toBe('in.(resolved,closed)');
    expect(buildCustomerRequestParams(DEFAULT_REQUEST_FILTERS, 'c').has('status')).toBe(false);
  });

  it('applies urgency, category and the sort order on the server', () => {
    const params = buildCustomerRequestParams(
      withFilters({ priority: 'urgent', category: 'billing', sort: 'urgency' }),
      'c'
    );
    expect(params.get('priority')).toBe('eq.urgent');
    expect(params.get('category')).toBe('eq.billing');
    expect(params.get('order')).toBe('urgency_rank.desc,updated_at.desc');
  });

  it('turns search text into a title/reference match and removes filter syntax', () => {
    const params = buildCustomerRequestParams(withFilters({ search: 'refund),(customer_id.eq.x' }), 'c');
    const or = params.get('or') ?? '';
    expect(or.startsWith('(title.ilike.*')).toBe(true);
    expect(or).toContain('reference.ilike.*');
    // Only the structure we add may contain parentheses and commas.
    expect(sanitizeSearch('refund),(customer_id.eq.x')).toBe('refund customer_id.eq.x');
    expect(sanitizeSearch('  50% "off" *  ')).toBe('50 off');
  });

  it('reads the total from content-range and sends the page range', async () => {
    const api = await client();
    api.get.mockResolvedValueOnce({ data: [{ id: 'r1', reference: 'REQ-1', title: 't', description: 'd', category: 'general', priority: 'low', status: 'open', customer_id: 'c', assigned_agent_id: null, created_at: 'x', updated_at: 'y', resolved_at: null }], headers: { 'content-range': '0-4/12' } });

    const result = await fetchMyRequests(DEFAULT_REQUEST_FILTERS, 'c', 1, 5);

    expect(result.total).toBe(12);
    expect(result.data[0]).toMatchObject({ customerId: 'c', assignedAgentId: null, createdAt: 'x' });
    expect(api.get.mock.calls[0][1]).toMatchObject({ headers: { Range: '0-4', Prefer: 'count=exact' } });
  });

  it('fetchRequest also filters by customer and reports a missing request as NotFoundError', async () => {
    const api = await client();
    api.get.mockResolvedValueOnce({ data: [] });

    await expect(fetchRequest('r-other', 'c')).rejects.toBeInstanceOf(NotFoundError);
    expect(api.get.mock.calls[0][1]).toMatchObject({
      params: expect.objectContaining({ id: 'eq.r-other', customer_id: 'eq.c' }),
    });
  });

  it('createRequest sends only the customer input; reference, owner and status come from the server', async () => {
    const api = await client();
    api.post.mockResolvedValueOnce({ data: [{ id: 'r9', reference: 'REQ-001001', title: 'Title here', description: 'Description long enough', category: 'billing', priority: 'high', status: 'open', customer_id: 'c', assigned_agent_id: null, created_at: 'x', updated_at: 'x', resolved_at: null }] });

    const created = await createRequest(
      { title: 'Title here', description: 'Description long enough', category: 'billing', priority: 'high' },
      'c'
    );

    const body = api.post.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['category', 'customer_id', 'description', 'priority', 'title']);
    expect(body).not.toHaveProperty('assigned_agent_id');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('reference');
    expect(created.assignedAgentId).toBeNull();
  });

  it('reopenRequest applies only while the request is still resolved', async () => {
    const api = await client();
    api.patch.mockResolvedValueOnce({ data: [] });

    await expect(reopenRequest('r1')).rejects.toBeInstanceOf(ConflictError);
    expect(api.patch.mock.calls[0][2]).toMatchObject({ params: { id: 'eq.r1', status: 'in.(resolved,closed)' } });
  });
});
