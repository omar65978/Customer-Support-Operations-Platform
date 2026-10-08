import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  attachmentTypeFor,
  downloadAttachment,
  uploadAttachment,
  validateAttachmentFile,
} from '../api/attachments';
import type { Attachment } from '../types';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

type MockClient = { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

async function client(): Promise<MockClient> {
  return ((await import('../api/axios')) as unknown as { default: MockClient }).default;
}

function fileOf(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('attachment rules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('accepts the listed types regardless of letter case and rejects everything else', () => {
    expect(attachmentTypeFor('Invoice.PDF')?.mimeType).toBe('application/pdf');
    expect(attachmentTypeFor('report.xlsx')?.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(attachmentTypeFor('setup.exe')).toBeNull();
    expect(attachmentTypeFor('archive')).toBeNull();
    expect(attachmentTypeFor('.pdf')).toBeNull();
    expect(attachmentTypeFor('page.html')).toBeNull();
  });

  it('explains why a file is refused: type, empty or too large', () => {
    expect(validateAttachmentFile(fileOf('x.pdf', 100))).toBeNull();
    expect(validateAttachmentFile(fileOf('virus.exe', 100))).toMatch(/not accepted/);
    expect(validateAttachmentFile(fileOf('empty.pdf', 0))).toMatch(/empty/);
    expect(validateAttachmentFile(fileOf('big.pdf', ATTACHMENT_MAX_BYTES + 1))).toMatch(/10 MB/);
  });

  it('does not contact the server for a refused file', async () => {
    const api = await client();
    await expect(uploadAttachment('req-1', fileOf('virus.exe', 100))).rejects.toThrow(/not accepted/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('stores the file under the request folder with a generated name, then records metadata without uploader fields', async () => {
    const api = await client();
    api.post
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({
        data: [{ id: 'a1', request_id: 'req-1', uploaded_by: 'u1', uploader_name: 'Alice', uploader_role: 'customer', original_name: 'Invoice.pdf', stored_name: 'req-1/x.pdf', mime_type: 'application/pdf', size: 100, created_at: 'now' }],
      });

    const saved = await uploadAttachment('req-1', fileOf('Invoice.pdf', 100));

    const [storageUrl, , storageConfig] = api.post.mock.calls[0];
    expect(String(storageUrl)).toMatch(/\/storage\/v1\/object\/attachments\/req-1\/[^/]+\.pdf$/);
    expect(storageConfig.headers['Content-Type']).toBe('application/pdf');

    const [metadataPath, metadataBody] = api.post.mock.calls[1];
    expect(metadataPath).toBe('/attachments');
    expect(metadataBody).toMatchObject({ request_id: 'req-1', original_name: 'Invoice.pdf', mime_type: 'application/pdf', size: 100 });
    expect(metadataBody).not.toHaveProperty('uploaded_by');
    expect(metadataBody).not.toHaveProperty('uploader_role');
    expect(saved.uploaderRole).toBe('customer');
  });

  it('downloads through the authenticated endpoint as a blob, so no token is placed in a URL', async () => {
    const api = await client();
    const get = api.get as unknown as ReturnType<typeof vi.fn>;
    get.mockResolvedValueOnce({ data: new Blob(['hello']) });
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const attachment: Attachment = {
      id: 'a1', requestId: 'req-1', uploadedBy: 'u1', uploaderName: 'Alice', uploaderRole: 'customer',
      originalName: 'Invoice.pdf', storedName: 'req-1/x.pdf', mimeType: 'application/pdf', size: 5, createdAt: 'now',
    };
    await downloadAttachment(attachment);

    expect(get.mock.calls[0][0]).toMatch(/\/storage\/v1\/object\/authenticated\/attachments\/req-1\/x\.pdf$/);
    expect(get.mock.calls[0][1]).toMatchObject({ responseType: 'blob' });
    expect(String(get.mock.calls[0][0])).not.toContain('token=');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
