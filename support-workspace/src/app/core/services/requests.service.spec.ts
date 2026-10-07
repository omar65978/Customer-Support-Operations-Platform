import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RequestsService } from './requests.service';

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

  it('loads a ranged manager page and exact count without fetching all requests', () => {
    service.getAll({}, undefined, true, 2, 10).subscribe((page) => {
      expect(page.data.length).toBe(1);
      expect(page.data[0].title).toBe('Test');
      expect(page.total).toBe(11);
      expect(page.page).toBe(2);
    });

    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('or')).toBeFalse();
    expect(request.request.params.get('order')).toBe('updated_at.desc');
    expect(request.request.headers.get('Prefer')).toBe('count=exact');
    expect(request.request.headers.get('Range')).toBe('10-19');
    request.flush([{
      id: 'r1', title: 'Test', reference: 'REQ-001', customer_id: 'c1', assigned_agent_id: 'a1',
      category: 'billing', priority: 'high', status: 'open', created_at: '2024-01-01', updated_at: '2024-01-01',
    }], { headers: { 'content-range': '10-10/11' } });
  });

  it('lets agents browse their own assignments and open unassigned work only', () => {
    service.getAll({}, 'agent-id-1', false, 1, 10).subscribe();
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests'));
    expect(request.request.params.get('or')).toBe('(assigned_agent_id.eq.agent-id-1,and(assigned_agent_id.is.null,status.in.(open,in_progress,waiting_for_customer)))');
    request.flush([], { headers: { 'content-range': '*/0' } });
  });

  it('combines agent work scope and multi-field search without replacing either filter', () => {
    service.getAll({ q: 'invoice #4' }, 'agent-id-1', false).subscribe();
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests'));
    expect(request.request.params.has('or')).toBeFalse();
    expect(request.request.params.get('and')).toContain('assigned_agent_id.eq.agent-id-1');
    expect(request.request.params.get('and')).toContain('title.ilike.*invoice 4*');
    expect(request.request.params.get('and')).toContain('description.ilike.*invoice 4*');
    request.flush([], { headers: { 'content-range': '*/0' } });
  });

  it('applies filters, safe sorting, and parses the content-range total', () => {
    service.getAll({ status: 'open', priority: 'high' }, undefined, true, 1, 10, 'priority', 'asc').subscribe((page) => {
      expect(page.total).toBe(25);
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests'));
    expect(request.request.params.get('status')).toBe('eq.open');
    expect(request.request.params.get('priority')).toBe('eq.high');
    expect(request.request.params.get('order')).toBe('priority.asc');
    request.flush([], { headers: { 'content-range': '0-9/25' } });
  });

  it('does not send client-controlled timestamps when updating request status', () => {
    service.updateStatus('r1', 'resolved').subscribe((request) => {
      expect(request.status).toBe('resolved');
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests') && candidate.params.get('id') === 'eq.r1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'resolved' });
    expect(request.request.headers.get('Prefer')).toBe('return=representation');
    request.flush([{
      id: 'r1', status: 'resolved', title: 'Test', reference: 'REQ-001', customer_id: 'c1',
      assigned_agent_id: null, category: 'billing', priority: 'high', created_at: '2024-01-01',
      updated_at: '2024-01-02', resolved_at: '2024-01-02',
    }]);
  });

  it('claims only an open unassigned request with conditional server filters', () => {
    service.assign('r1', 'agent-1').subscribe((request) => {
      expect(request.assignedAgentId).toBe('agent-1');
      expect(request.status).toBe('in_progress');
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests') && candidate.params.get('id') === 'eq.r1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.params.get('assigned_agent_id')).toBe('is.null');
    expect(request.request.params.get('status')).toBe('eq.open');
    expect(request.request.body).toEqual({ assigned_agent_id: 'agent-1', status: 'in_progress' });
    request.flush([{
      id: 'r1', status: 'in_progress', title: 'Test', reference: 'REQ-001', customer_id: 'c1',
      assigned_agent_id: 'agent-1', category: 'billing', priority: 'high', created_at: '2024-01-01', updated_at: '2024-01-02',
    }]);
  });

  it('keeps an available request waiting for the customer when an agent claims it', () => {
    service.assign('r1', 'agent-1', false, 'waiting_for_customer').subscribe((request) => {
      expect(request.status).toBe('waiting_for_customer');
      expect(request.assignedAgentId).toBe('agent-1');
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests') && candidate.params.get('id') === 'eq.r1');
    expect(request.request.params.get('status')).toBe('eq.waiting_for_customer');
    expect(request.request.body.status).toBe('waiting_for_customer');
    request.flush([{
      id: 'r1', status: 'waiting_for_customer', title: 'Test', reference: 'REQ-001', customer_id: 'c1',
      assigned_agent_id: 'agent-1', category: 'billing', priority: 'high', created_at: '2024-01-01', updated_at: '2024-01-02',
    }]);
  });

  it('lets managers reassign without changing request progress', () => {
    service.assign('r1', 'agent-2', true).subscribe();
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests') && candidate.params.get('id') === 'eq.r1');
    expect(request.request.params.has('assigned_agent_id')).toBeFalse();
    expect(request.request.body).toEqual({ assigned_agent_id: 'agent-2' });
    request.flush([{
      id: 'r1', status: 'waiting_for_customer', title: 'Test', reference: 'REQ-001', customer_id: 'c1',
      assigned_agent_id: 'agent-2', category: 'billing', priority: 'high', created_at: '2024-01-01', updated_at: '2024-01-02',
    }]);
  });

  it('maps snake_case request rows to the shared frontend model', () => {
    service.getOne('r1').subscribe((request) => {
      expect(request.customerId).toBe('cust-1');
      expect(request.assignedAgentId).toBe('agt-1');
      expect(request.createdAt).toBe('2024-01-01');
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/requests') && candidate.params.get('id') === 'eq.r1');
    request.flush([{
      id: 'r1', title: 'Test', reference: 'REQ-001', customer_id: 'cust-1', assigned_agent_id: 'agt-1',
      category: 'billing', priority: 'high', status: 'open', created_at: '2024-01-01', updated_at: '2024-01-01', resolved_at: null,
    }]);
  });

  it('reports an empty conditional update as a failed action instead of pretending it succeeded', () => {
    let errorMessage = '';
    service.assign('r1', 'agent-1').subscribe({ error: (error: Error) => { errorMessage = error.message; } });
    httpMock.expectOne((candidate) => candidate.url.includes('/requests')).flush([]);
    expect(errorMessage).toContain('changed by another user');
  });
});
