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

  it('getAll for manager fetches without assignedAgentId filter', () => {
    service.getAll({}, undefined, true).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/requests` && !r.params.has('assignedAgentId')
    );
    expect(req.request.method).toBe('GET');
    req.flush([], { headers: { 'x-total-count': '0' } });
  });

  it('getAll for agent adds assignedAgentId filter', () => {
    service.getAll({}, 'u3', false).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/requests` && r.params.get('assignedAgentId') === 'u3'
    );
    expect(req.request.method).toBe('GET');
    req.flush([], { headers: { 'x-total-count': '0' } });
  });

  it('getAll applies status filter as query parameter', () => {
    service.getAll({ status: 'open' }, undefined, true).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/requests` && r.params.get('status') === 'open'
    );
    expect(req.request.method).toBe('GET');
    req.flush([], { headers: { 'x-total-count': '0' } });
  });

  it('getAll uses _q param for search query', () => {
    service.getAll({ q: 'billing' }, undefined, true).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/requests` && r.params.get('_q') === 'billing'
    );
    expect(req.request.method).toBe('GET');
    req.flush([], { headers: { 'x-total-count': '0' } });
  });

  it('getAll reads total from x-total-count header', (done) => {
    service.getAll({}, undefined, true).subscribe((page) => {
      expect(page.total).toBe(7);
      done();
    });
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/requests`);
    req.flush([], { headers: { 'x-total-count': '7' } });
  });

  it('getAll passes pagination params', () => {
    service.getAll({}, undefined, true, 2, 25).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.apiUrl}/requests` &&
      r.params.get('_page') === '2' &&
      r.params.get('_limit') === '25'
    );
    expect(req.request.method).toBe('GET');
    req.flush([], { headers: { 'x-total-count': '0' } });
  });

  it('updateStatus sends PATCH with resolved timestamp when status is resolved', () => {
    service.updateStatus('r1', 'resolved').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.status).toBe('resolved');
    expect(req.request.body.resolvedAt).toBeTruthy();
    req.flush({});
  });

  it('updateStatus sets resolvedAt to null when status is not resolved', () => {
    service.updateStatus('r1', 'in_progress').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1`);
    expect(req.request.body.resolvedAt).toBeNull();
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
