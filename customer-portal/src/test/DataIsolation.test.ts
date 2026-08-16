import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMessages } from '../api/messages';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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
        id: 'm1', requestId: 'r1', authorId: 'u1', authorName: 'Alice',
        authorRole: 'customer' as const, content: 'My billing issue', isInternal: false,
        createdAt: '2026-08-01T09:00:00Z',
      },
      {
        id: 'm2', requestId: 'r1', authorId: 'u3', authorName: 'Sarah',
        authorRole: 'agent' as const, content: 'Database migration issue — internal only', isInternal: true,
        createdAt: '2026-08-01T10:00:00Z',
      },
      {
        id: 'm3', requestId: 'r1', authorId: 'u3', authorName: 'Sarah',
        authorRole: 'agent' as const, content: 'We are looking into this for you', isInternal: false,
        createdAt: '2026-08-01T10:30:00Z',
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
        id: 'mi1', requestId: 'r1', authorId: 'u3', authorName: 'Agent',
        authorRole: 'agent' as const, content: 'Internal team note about billing', isInternal: true,
        createdAt: '2026-08-01T10:00:00Z',
      },
      {
        id: 'mi2', requestId: 'r1', authorId: 'u5', authorName: 'Manager',
        authorRole: 'manager' as const, content: 'Escalation note for manager review', isInternal: true,
        createdAt: '2026-08-01T11:00:00Z',
      },
    ];

    mockClient.get.mockResolvedValueOnce({ data: onlyInternalMessages });

    const result = await fetchMessages('r1');

    expect(result).toHaveLength(0);
  });

  it('sendMessage always sets isInternal=false and authorRole=customer', async () => {
    const { default: mockClient } = await import('../api/axios') as unknown as { default: { post: ReturnType<typeof vi.fn> } };
    const { sendMessage } = await import('../api/messages');

    mockClient.post.mockResolvedValueOnce({
      data: {
        id: 'mnew', requestId: 'r1', authorId: 'u1', authorName: 'Alice',
        authorRole: 'customer', content: 'My reply', isInternal: false,
        createdAt: new Date().toISOString(),
      },
    });

    await sendMessage('r1', { content: 'My reply' }, 'u1', 'Alice');

    expect(mockClient.post).toHaveBeenCalledWith('/messages', expect.objectContaining({
      isInternal: false,
      authorRole: 'customer',
    }));
  });
});
