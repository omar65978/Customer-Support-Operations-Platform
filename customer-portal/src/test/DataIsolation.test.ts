import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMessages, sendMessage } from '../api/messages';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

type MockClient = { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

async function client(): Promise<MockClient> {
  const mod = (await import('../api/axios')) as unknown as { default: MockClient };
  return mod.default;
}

describe('Customer data isolation (client side)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('asks the server only for public messages and drops any internal row it still receives', async () => {
    const api = await client();
    api.get.mockResolvedValueOnce({
      data: [
        { id: 'm1', request_id: 'r1', author_id: 'u1', author_name: 'Alice', author_role: 'customer', content: 'My billing issue', is_internal: false, created_at: '2026-08-01T09:00:00Z' },
        { id: 'm2', request_id: 'r1', author_id: 'u3', author_name: 'Sarah', author_role: 'agent', content: 'Database migration issue, internal only', is_internal: true, created_at: '2026-08-01T10:00:00Z' },
        { id: 'm3', request_id: 'r1', author_id: 'u3', author_name: 'Sarah', author_role: 'agent', content: 'We are looking into this', is_internal: false, created_at: '2026-08-01T10:30:00Z' },
      ],
    });

    const result = await fetchMessages('r1');

    expect(api.get).toHaveBeenCalledWith(
      '/messages',
      expect.objectContaining({
        params: expect.objectContaining({ request_id: 'eq.r1', is_internal: 'eq.false' }),
      })
    );
    expect(result).toHaveLength(2);
    expect(result.every((m) => !m.isInternal)).toBe(true);
    expect(result.find((m) => m.content.includes('internal only'))).toBeUndefined();
  });

  it('returns an empty conversation when every message is internal', async () => {
    const api = await client();
    api.get.mockResolvedValueOnce({
      data: [
        { id: 'mi1', request_id: 'r1', author_id: 'u3', author_name: 'Agent', author_role: 'agent', content: 'Internal team note', is_internal: true, created_at: '2026-08-01T10:00:00Z' },
      ],
    });

    expect(await fetchMessages('r1')).toEqual([]);
  });

  it('sends only the request, content and is_internal=false; the server sets the author', async () => {
    const api = await client();
    // Even if the browser holds a different identity, it must not be sent as the author.
    localStorage.setItem('user', JSON.stringify({ id: 'u9', name: 'Someone Else', role: 'manager' }));
    api.post.mockResolvedValueOnce({
      data: [{ id: 'mnew', request_id: 'r1', author_id: 'u1', author_name: 'Alice', author_role: 'customer', content: 'My reply', is_internal: false, created_at: new Date().toISOString() }],
    });

    const saved = await sendMessage('r1', 'My reply');

    expect(api.post).toHaveBeenCalledWith(
      '/messages',
      { request_id: 'r1', content: 'My reply', is_internal: false },
      expect.objectContaining({ headers: expect.objectContaining({ Prefer: 'return=representation' }) })
    );
    const body = api.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('author_id');
    expect(body).not.toHaveProperty('author_name');
    expect(body).not.toHaveProperty('author_role');
    expect(saved.authorId).toBe('u1');
  });

  it('maps snake_case rows to the camelCase model used by the UI', async () => {
    const api = await client();
    api.get.mockResolvedValueOnce({
      data: [{ id: 'm1', request_id: 'r1', author_id: 'u1', author_name: 'Alice', author_role: 'customer', content: 'Test', is_internal: false, created_at: '2026-08-01T09:00:00Z' }],
    });

    const [message] = await fetchMessages('r1');

    expect(message).toMatchObject({
      requestId: 'r1',
      authorId: 'u1',
      authorName: 'Alice',
      authorRole: 'customer',
      createdAt: '2026-08-01T09:00:00Z',
      isInternal: false,
    });
  });
});
