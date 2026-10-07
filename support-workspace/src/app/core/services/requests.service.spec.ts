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
      providers: [RequestsService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RequestsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll for manager fetches without assigned_agent_id filter', () => {
    service.getAll({}, undefined, true, 1, 10).subscribe(page => {
      expect(page.data.length).toBe(1);
      expect(page.data[0].title).toBe('Test');
    });

    const req = httpMock.expectOne(r => r.url.includes('/requests') && !r.params.has('assigned_agent_id'));
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Prefer')).toBe('count=exact');
    expect(req.request.headers.get('Range')).toBe('0-9');
    req.flush([{ id: 'r1', title: 'Test', reference: 'REQ-001', customer_id: 'c1', assigned_agent_id: 'a1', category: 'billing', priority: 'high', status: 'open', created_at: '2024-01-01', updated_at: '2024-01-01' }], {
      headers: { 'content-range': '0-0/1' }
    });
  });

  it('getAll for agent adds assigned_agent_id filter', () => {
    service.getAll({}, 'agent-id-1', false, 1, 10).subscribe();

    const req = httpMock.expectOne(r => r.url.includes('/requests') && r.params.get('assigned_agent_id') === 'eq.agent-id-1');
    expect(req.request.method).toBe('GET');
    req.flush([], { headers: { 'content-range': '*/0' } });
  });

  it('getAll applies status filter as query parameter', () => {
    service.getAll({ status: 'open' }, undefined, true, 1, 10).subscribe();

    const req = httpMock.expectOne(r => r.params.get('status') === 'eq.open');
    req.flush([], { headers: { 'content-range': '*/0' } });
  });

  it('getAll reads total from content-range header', () => {
    service.getAll({}, undefined, true, 1, 10).subscribe(page => {
      expect(page.total).toBe(25);
    });

    const req = httpMock.expectOne(r => r.url.includes('/requests'));
    req.flush([], { headers: { 'content-range': '0-9/25' } });
  });

  it('updateStatus sends PATCH with resolved timestamp', () => {
    service.updateStatus('r1', 'resolved').subscribe(r => {
      expect(r.status).toBe('resolved');
    });

    const req = httpMock.expectOne(r => r.url.includes('/requests?id=eq.r1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.status).toBe('resolved');
    expect(req.request.body.resolved_at).toBeTruthy();
    expect(req.request.headers.get('Prefer')).toBe('return=representation');
    req.flush([{ id: 'r1', status: 'resolved', title: 'Test', reference: 'REQ-001', customer_id: 'c1', assigned_agent_id: null, category: 'billing', priority: 'high', created_at: '2024-01-01', updated_at: '2024-01-01', resolved_at: '2024-01-02' }]);
  });

  it('assign sends PATCH with agentId and sets status to in_progress', () => {
    service.assign('r1', 'agent-1').subscribe(r => {
      expect(r.assignedAgentId).toBe('agent-1');
      expect(r.status).toBe('in_progress');
    });

    const req = httpMock.expectOne(r => r.url.includes('/requests?id=eq.r1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.assigned_agent_id).toBe('agent-1');
    expect(req.request.body.status).toBe('in_progress');
    req.flush([{ id: 'r1', status: 'in_progress', title: 'Test', reference: 'REQ-001', customer_id: 'c1', assigned_agent_id: 'agent-1', category: 'billing', priority: 'high', created_at: '2024-01-01', updated_at: '2024-01-01', resolved_at: null }]);
  });

  it('close sends PATCH with status closed', () => {
    service.close('r1').subscribe(r => {
      expect(r.status).toBe('closed');
    });

    const req = httpMock.expectOne(r => r.url.includes('/requests?id=eq.r1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.status).toBe('closed');
    req.flush([{ id: 'r1', status: 'closed', title: 'Test', reference: 'REQ-001', customer_id: 'c1', assigned_agent_id: null, category: 'billing', priority: 'high', created_at: '2024-01-01', updated_at: '2024-01-01', resolved_at: null }]);
  });

  it('maps snake_case response to camelCase model', () => {
    service.getOne('r1').subscribe(r => {
      expect(r.customerId).toBe('cust-1');
      expect(r.assignedAgentId).toBe('agt-1');
      expect(r.createdAt).toBe('2024-01-01');
    });

    const req = httpMock.expectOne(r => r.url.includes('/requests?id=eq.r1'));
    req.flush([{ id: 'r1', title: 'Test', reference: 'REQ-001', customer_id: 'cust-1', assigned_agent_id: 'agt-1', category: 'billing', priority: 'high', status: 'open', created_at: '2024-01-01', updated_at: '2024-01-01', resolved_at: null }]);
  });
});
