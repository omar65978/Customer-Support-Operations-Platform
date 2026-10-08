import { describe, it, expect } from 'vitest';
import { mergeMessages } from '../hooks/useMessages';
import type { Message } from '../types';

const msg = (id: string, createdAt: string, content = id): Message => ({
  id,
  requestId: 'r1',
  authorId: 'u1',
  authorName: 'Alice',
  authorRole: 'customer',
  content,
  isInternal: false,
  createdAt,
});

describe('mergeMessages', () => {
  it('never shows the same message twice when a refresh returns it again', () => {
    const current = [msg('a', '2026-08-01T09:00:00Z'), msg('b', '2026-08-01T10:00:00Z')];
    const refreshed = [msg('a', '2026-08-01T09:00:00Z'), msg('b', '2026-08-01T10:00:00Z'), msg('c', '2026-08-01T11:00:00Z')];

    const merged = mergeMessages(current, refreshed);

    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps messages in time order even when they arrive out of order', () => {
    const merged = mergeMessages([msg('late', '2026-08-01T12:00:00Z')], [msg('early', '2026-08-01T08:00:00Z')]);
    expect(merged.map((m) => m.id)).toEqual(['early', 'late']);
  });

  it('updates an existing message in place when its content changes', () => {
    const merged = mergeMessages([msg('a', '2026-08-01T09:00:00Z', 'old')], [msg('a', '2026-08-01T09:00:00Z', 'new')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].content).toBe('new');
  });
});
