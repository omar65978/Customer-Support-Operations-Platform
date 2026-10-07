import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AttachmentsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttachmentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads attachment metadata only for a specific request', () => {
    service.getForRequest('r1').subscribe((attachments) => {
      expect(attachments.length).toBe(1);
      expect(attachments[0].requestId).toBe('r1');
      expect(attachments[0].storagePath).toBe('r1/one.pdf');
      expect(attachments[0].size).toBe(512);
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/attachments'));
    expect(request.request.params.get('request_id')).toBe('eq.r1');
    request.flush([{
      id: 'a1', request_id: 'r1', uploaded_by: 'u3', uploader_name: 'Agent', uploader_role: 'agent',
      original_name: 'one.pdf', storage_path: 'r1/one.pdf', mime_type: 'application/pdf', size_bytes: 512,
      created_at: '2026-10-07T00:00:00Z',
    }]);
  });

  it('rejects unsupported file types before starting a Storage request', async () => {
    let errorMessage = '';
    service.upload('r1', new File(['executable'], 'payload.exe', { type: 'application/octet-stream' })).subscribe({
      error: (error: Error) => { errorMessage = error.message; },
    });
    await Promise.resolve();
    expect(errorMessage).toContain('permitted file type');
    httpMock.expectNone((request) => request.url.includes('/attachments'));
  });
});
