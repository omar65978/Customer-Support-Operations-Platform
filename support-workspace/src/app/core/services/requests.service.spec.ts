import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RequestsService, buildStaffRequestParams, DEFAULT_REQUEST_QUERY, type RequestQuery } from './requests.service';
import { ConflictError, NotFoundError } from '../utils/errors';
import { environment } from '../../../environments/environment';

const agent = { id: 'agent-1', role: 'agent' as const };
const manager = { id: 'mgr-1', role: 'manager' as const };
const query = (patch: Partial<RequestQuery> = {}): RequestQuery => ({ ...DEFAULT_REQUEST_QUERY, ...patch });

const rawRequest = {
  id: 'r1', reference: 'REQ-001001', title: 'Refund not received', description: 'Refund was promised last week',
  category: 'billing', priority: 'high', status: 'open', customer_id: 'c1', assigned_agent_id: null,
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', resolved_at: null,
};

describe('buildStaffRequestParams', () => {
  it('limits an agent to own and unclaimed requests on the server', () => {
    const and = buildStaffRequestParams(query(), agent).get('and') ?? '';
    expect(and).toContain('or(assigned_agent_id.is.null,assigned_agent_id.eq.agent-1)');
  });

  it('does not limit a manager to a single owner', () => {
    const params = buildStaffRequestParams(query(), manager);
    expect(params.has('and')).toBeFalse();
    expect(params.get('order')).toBe('updated_at.desc');
  });

  it('builds the "needs attention" view from open or in-progress work that is unassigned or urgent/high', () => {
    const and = buildStaffRequestParams(query({ view: 'attention' }), manager).get('and') ?? '';
    expect(and).toContain('or(status.eq.open,status.eq.in_progress)');
    expect(and).toContain('or(assigned_agent_id.is.null,priority.eq.urgent,priority.eq.high)');
  });

  it('builds the unassigned, urgent and mine views', () => {
    expect(buildStaffRequestParams(query({ view: 'unassigned' }), manager).get('and')).toContain('assigned_agent_id.is.null');
    expect(buildStaffRequestParams(query({ view: 'urgent' }), manager).get('and')).toContain('priority.eq.urgent');
    expect(buildStaffRequestParams(query({ view: 'mine' }), agent).get('and')).toContain('assigned_agent_id.eq.agent-1');
  });

  it('combines view, status, urgency and category filters in one group', () => {
    const and = buildStaffRequestParams(
      query({ view: 'urgent', status: 'in_progress', priority: 'urgent', category: 'technical' }),
      manager
    ).get('and') ?? '';
    expect(and).toBe('(priority.eq.urgent,status.eq.in_progress,priority.eq.urgent,category.eq.technical)');
  });

  it('turns search text into a title/reference match without filter syntax', () => {
    const and = buildStaffRequestParams(query({ search: 'refund),(status.eq.closed' }), manager).get('and') ?? '';
    expect(and).toContain('or(title.ilike.*refund status.eq.closed*,reference.ilike.*refund status.eq.closed*)');
  });

  it('sorts by urgency with a secondary order on update time', () => {
    const params = buildStaffRequestParams(query({ sortBy: 'urgency_rank', sortDirection: 'desc' }), manager);
    expect(params.get('order')).toBe('urgency_rank.desc,updated_at.desc');
  });
});

describe('RequestsService', () => {
  let service: RequestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list requests a page with count and reads the total', () => {
    let total = -1;
    service.list(query(), manager, 2, 10).subscribe((page) => {
      total = page.total;
      expect(page.data[0]).toEqual(jasmine.objectContaining({ customerId: 'c1', assignedAgentId: null, reference: 'REQ-001001' }));
    });
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/requests`);
    expect(req.request.headers.get('Range')).toBe('10-19');
    expect(req.request.headers.get('Prefer')).toBe('count=exact');
    req.flush([rawRequest], { headers: { 'content-range': '10-10/31' } });
    expect(total).toBe(31);
  });

  it('count reads only the number of matching rows', () => {
    let value = -1;
    service.count(query({ view: 'unassigned' }), manager).subscribe((n) => (value = n));
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/requests`);
    expect(req.request.headers.get('Range')).toBe('0-0');
    req.flush([], { headers: { 'content-range': '*/4' } });
    expect(value).toBe(4);
  });

  it('claim only succeeds while the request is still unassigned', () => {
    let claimed: { assignedAgentId: string | null } | undefined;
    service.claim('r1', 'agent-1').subscribe((r) => (claimed = r));
    const req = http.expectOne((r) => r.method === 'PATCH');
    expect(req.request.params.get('assigned_agent_id')).toBe('is.null');
    expect(req.request.params.get('id')).toBe('eq.r1');
    expect(req.request.body).toEqual({ assigned_agent_id: 'agent-1' });
    req.flush([{ ...rawRequest, assigned_agent_id: 'agent-1', status: 'in_progress' }]);
    expect(claimed?.assignedAgentId).toBe('agent-1');
  });

  it('claim reports a conflict when another agent got there first', () => {
    let error: unknown;
    service.claim('r1', 'agent-2').subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.method === 'PATCH').flush([]);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toMatch(/already claimed/i);
  });

  it('reassign expects the current owner so a stale screen cannot overwrite a newer one', () => {
    service.assign('r1', 'agent-1', 'agent-2').subscribe();
    const req = http.expectOne((r) => r.method === 'PATCH');
    expect(req.request.params.get('assigned_agent_id')).toBe('eq.agent-1');
    expect(req.request.body).toEqual({ assigned_agent_id: 'agent-2' });
    req.flush([{ ...rawRequest, assigned_agent_id: 'agent-2' }]);
  });

  it('updateStatus sends only the new status and the status it expects to replace', () => {
    service.updateStatus('r1', 'in_progress', 'resolved').subscribe();
    const req = http.expectOne((r) => r.method === 'PATCH');
    expect(req.request.params.get('status')).toBe('eq.in_progress');
    expect(req.request.body).toEqual({ status: 'resolved' });
    req.flush([{ ...rawRequest, status: 'resolved' }]);
  });

  it('updateStatus reports a conflict when the status has moved on', () => {
    let error: unknown;
    service.updateStatus('r1', 'in_progress', 'resolved').subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.method === 'PATCH').flush([]);
    expect(error).toBeInstanceOf(ConflictError);
  });

  it('getOne reports a missing or hidden request as not found', () => {
    let error: unknown;
    service.getOne('someone-elses').subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === `${environment.apiUrl}/requests`).flush([]);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});
