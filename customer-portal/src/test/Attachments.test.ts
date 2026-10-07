import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAttachment, downloadAttachment, validateAttachment } from '../api/attachments';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../api/auth', () => ({
  refreshAuthSession: vi.fn(),
  saveAuthSession: vi.fn(),
}));

vi.mock('../config/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  supabaseConfig: {
    url: 'https://support.test',
    authUrl: 'https://support.test/auth/v1',
    restUrl: 'https://support.test/rest/v1',
    storageUrl: 'https://support.test/storage/v1',
    anonKey: 'public-anon-key',
    isConfigured: true,
  },
}));

describe('protected request attachments', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let apiClient: { post: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('token', 'customer-token');
    localStorage.setItem('user', JSON.stringify({ id: 'forged-id', role: 'manager' }));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'file-key' });
    const apiModule = await import('../api/axios');
    apiClient = apiModule.default as unknown as { post: ReturnType<typeof vi.fn> };
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('rejects unsupported files before any network request', async () => {
    const file = new File(['unsafe'], 'payload.exe', { type: 'application/octet-stream' });
    expect(validateAttachment(file)).toContain('not allowed');
    await expect(uploadAttachment('r1', file)).rejects.toThrow('not allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads to private Storage then stores only request/file metadata', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    apiClient.post.mockResolvedValueOnce({
      data: [{
        id: 'a1', request_id: 'r1', uploaded_by: 'customer-id', uploader_name: 'Customer',
        uploader_role: 'customer', original_name: 'statement.pdf', storage_path: 'r1/file-key-statement.pdf',
        mime_type: 'application/pdf', size_bytes: 7, created_at: '2026-10-07T00:00:00Z',
      }],
    });
    const file = new File(['pdfdata'], 'statement.pdf', { type: 'application/pdf' });

    const attachment = await uploadAttachment('r1', file);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/storage/v1/object/attachments/r1/file-key-statement.pdf');
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer customer-token');
    expect(apiClient.post).toHaveBeenCalledWith('/attachments', expect.objectContaining({
      request_id: 'r1',
      storage_path: 'r1/file-key-statement.pdf',
      original_name: 'statement.pdf',
      mime_type: 'application/pdf',
      size_bytes: 7,
    }), expect.anything());
    const metadata = apiClient.post.mock.calls[0][1];
    expect(metadata.uploaded_by).toBeUndefined();
    expect(metadata.uploader_role).toBeUndefined();
    expect(attachment.uploadedBy).toBe('customer-id');
  });

  it('uses an Authorization header rather than putting a bearer token in the download URL', async () => {
    const blob = new Blob(['private file']);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, blob: vi.fn().mockResolvedValue(blob) } as unknown as Response);

    const result = await downloadAttachment('r1/folder name.pdf');

    expect(result).toBe(blob);
    expect(fetchMock.mock.calls[0][0]).toBe('https://support.test/storage/v1/object/authenticated/attachments/r1/folder%20name.pdf');
    expect(fetchMock.mock.calls[0][0]).not.toContain('token=');
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer customer-token');
  });

  it('removes a just-uploaded object if its metadata insert fails', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);
    apiClient.post.mockRejectedValueOnce(new Error('metadata denied'));
    const file = new File(['plain text'], 'note.txt', { type: 'text/plain' });

    await expect(uploadAttachment('r1', file)).rejects.toThrow('metadata denied');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });
});
