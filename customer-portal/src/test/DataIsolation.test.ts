import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMessages } from '../api/messages';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    defaults: { baseURL: 'https://test.supabase.co/rest/v1' },
  },
}));

describe('Customer data isolation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetchMessages filters out internal notes before returning to caller', async () => {
    const { default: mockClient } = await import('../api/axios') as unknown as { default: { get: ReturnType<typeof vi.fn> } };

    const rawMessages = [
      {
        id: 'm1', request_id: 'r1', author_id: 'u1', author_name: 'Alice',
        author_role: 'customer', content: 'My billing issue', is_internal: false,
        created_at: '2026-08-01T09:00:00Z',
      },
      {
        id: 'm2', request_id: 'r1', author_id: 'u3', author_name: 'Sarah',
        author_role: 'agent', content: 'Database migration issue — internal only', is_internal: true,
        created_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 'm3', request_id: 'r1', author_id: 'u3', author_name: 'Sarah',
        author_role: 'agent', content: 'We are looking into this for you', is_internal: false,
        created_at: '2026-08-01T10:30:00Z',
      },
    ];

    mockClient.get.mockResolvedValueOnce({ data: rawMessages });

    const result = await fetchMessages('r1');

    expect(result).toHaveLength(2);
    expect(result.every((m) => !m.isInternal)).toBe(true);
    expect(result.find((m) => m.content.includes('internal only'))).toBeUndefined();
  });

  it('fetchMessages returns empty array when all messages are internal', async () => {
    const { default: mockClient } = await import('../api/axios') as unknown as { default: { get: ReturnType<typeof vi.fn> } };

    const onlyInternalMessages = [
      {
        id: 'mi1', request_id: 'r1', author_id: 'u3', author_name: 'Agent',
        author_role: 'agent', content: 'Internal team note about billing', is_internal: true,
        created_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 'mi2', request_id: 'r1', author_id: 'u5', author_name: 'Manager',
        author_role: 'manager', content: 'Escalation note for manager review', is_internal: true,
        created_at: '2026-08-01T11:00:00Z',
      },
    ];

    mockClient.get.mockResolvedValueOnce({ data: onlyInternalMessages });

    const result = await fetchMessages('r1');

    expect(result).toHaveLength(0);
  });

  it('sendMessage posts to /messages with is_internal=false', async () => {
    const { default: mockClient } = await import('../api/axios') as unknown as { default: { post: ReturnType<typeof vi.fn> } };
    const { sendMessage } = await import('../api/messages');

    localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Alice', role: 'customer' }));

    mockClient.post.mockResolvedValueOnce({
      data: [{
        id: 'mnew', request_id: 'r1', author_id: 'u1', author_name: 'Alice',
        author_role: 'customer', content: 'My reply', is_internal: false,
        created_at: new Date().toISOString(),
      }],
    });

    await sendMessage('r1', { content: 'My reply' });

    expect(mockClient.post).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({
        is_internal: false,
        content: 'My reply',
        request_id: 'r1',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Prefer: 'return=representation' }),
      })
    );

    localStorage.removeItem('user');
  });

  it('fetchMessages maps snake_case to camelCase fields', async () => {
    const { default: mockClient } = await import('../api/axios') as unknown as { default: { get: ReturnType<typeof vi.fn> } };

    mockClient.get.mockResolvedValueOnce({
      data: [{
        id: 'm1', request_id: 'r1', author_id: 'u1', author_name: 'Alice',
        author_role: 'customer', content: 'Test', is_internal: false,
        created_at: '2026-08-01T09:00:00Z',
      }],
    });

    const result = await fetchMessages('r1');

    expect(result[0].requestId).toBe('r1');
    expect(result[0].authorId).toBe('u1');
    expect(result[0].authorName).toBe('Alice');
    expect(result[0].authorRole).toBe('customer');
    expect(result[0].createdAt).toBe('2026-08-01T09:00:00Z');
  });
});
