import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RequestsService } from './requests.service';
import { environment } from '../../../environments/environment';

describe('RequestsService', () => {
  let service: RequestsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RequestsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RequestsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll fetches all requests without filters', () => {
    service.getAll().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getAll applies status filter as query parameter', () => {
    service.getAll({ status: 'open' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests?status=open`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getAll applies priority filter as query parameter', () => {
    service.getAll({ priority: 'urgent' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests?priority=urgent`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('updateStatus sends PATCH with resolved timestamp when status is resolved', () => {
    service.updateStatus('r1', 'resolved').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.status).toBe('resolved');
    expect(req.request.body.resolvedAt).toBeTruthy();
    req.flush({});
  });

  it('updateStatus does not set resolvedAt when status is not resolved', () => {
    service.updateStatus('r1', 'in_progress').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.body.resolvedAt).toBeUndefined();
    req.flush({});
  });

  it('assign sends PATCH with agentId and sets status to in_progress', () => {
    service.assign('r1', 'u3').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.assignedAgentId).toBe('u3');
    expect(req.request.body.status).toBe('in_progress');
    req.flush({});
  });

  it('assign with null agentId sets status back to open', () => {
    service.assign('r1', null).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.body.assignedAgentId).toBeNull();
    expect(req.request.body.status).toBe('open');
    req.flush({});
  });

  it('close sends PATCH with status closed', () => {
    service.close('r1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.body.status).toBe('closed');
    req.flush({});
  });
});
