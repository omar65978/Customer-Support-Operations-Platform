import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AttachmentsService } from './attachments.service';
import { ValidationError } from '../utils/errors';
import { ATTACHMENT_MAX_BYTES, attachmentTypeFor, validateAttachmentFile } from '../utils/attachments';
import { environment } from '../../../environments/environment';
import type { Attachment } from '../models';

function fileOf(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('attachment rules (Angular)', () => {
  it('accepts the listed types in any letter case and refuses the rest', () => {
    expect(attachmentTypeFor('Report.PDF')?.mimeType).toBe('application/pdf');
    expect(attachmentTypeFor('tool.exe')).toBeNull();
    expect(attachmentTypeFor('noextension')).toBeNull();
    expect(validateAttachmentFile(fileOf('ok.csv', 10))).toBeNull();
    expect(validateAttachmentFile(fileOf('ok.csv', 0))).toMatch(/empty/);
    expect(validateAttachmentFile(fileOf('big.pdf', ATTACHMENT_MAX_BYTES + 1))).toMatch(/10 MB/);
  });
});

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AttachmentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('refuses an invalid file without contacting the server', () => {
    let error: unknown;
    service.upload('r1', fileOf('virus.exe', 10)).subscribe({ error: (e) => (error = e) });
    expect(error).toBeInstanceOf(ValidationError);
    http.expectNone(() => true);
  });

  it('stores the file under the request folder, then records metadata that the uploader does not control', () => {
    let saved: Attachment | undefined;
    service.upload('r1', fileOf('Invoice March.pdf', 2048)).subscribe((a) => (saved = a));

    const storage = http.expectOne((r) => r.method === 'POST' && r.url.includes('/storage/v1/object/attachments/r1/'));
    expect(storage.request.url.endsWith('.pdf')).toBeTrue();
    expect(storage.request.headers.get('Content-Type')).toBe('application/pdf');
    storage.flush({ Key: 'attachments/x' });

    const meta = http.expectOne(`${environment.apiUrl}/attachments`);
    expect(meta.request.body).toEqual(
      jasmine.objectContaining({ request_id: 'r1', original_name: 'Invoice March.pdf', mime_type: 'application/pdf', size: 2048 })
    );
    expect(meta.request.body).not.toEqual(jasmine.objectContaining({ uploaded_by: jasmine.anything() }));
    expect(meta.request.body).not.toEqual(jasmine.objectContaining({ uploader_role: jasmine.anything() }));
    meta.flush([{ id: 'a1', request_id: 'r1', uploaded_by: 'u1', uploader_name: 'Sarah', uploader_role: 'agent', original_name: 'Invoice March.pdf', stored_name: 'r1/x.pdf', mime_type: 'application/pdf', size: 2048, created_at: 'now' }]);

    expect(saved?.uploaderRole).toBe('agent');
  });

  it('downloads through the authenticated endpoint, not a URL with a token', () => {
    let done = false;
    service.download({
      id: 'a1', requestId: 'r1', uploadedBy: 'u1', uploaderName: 'Sarah', uploaderRole: 'agent',
      originalName: 'Invoice.pdf', storedName: 'r1/x.pdf', mimeType: 'application/pdf', size: 2, createdAt: 'now',
    }).subscribe(() => (done = true));

    const req = http.expectOne(`${environment.supabaseUrl}/storage/v1/object/authenticated/attachments/r1/x.pdf`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.url).not.toContain('token=');
    req.flush(new Blob(['%PDF-1.4']));
    expect(done).toBeTrue();
  });
});
