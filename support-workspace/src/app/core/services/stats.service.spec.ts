import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StatsService } from './stats.service';
import { environment } from '../../../environments/environment';

describe('StatsService', () => {
  let service: StatsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StatsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads per-agent workload with counts only, one query group per agent', () => {
    let rows: { active: number; waiting: number; urgent: number }[] = [];
    service.getWorkload([{ id: 'agent-1', email: 'a@x.com', name: 'Sarah', role: 'agent' }]).subscribe((r) => (rows = r));

    const requests = http.match((r) => r.url === `${environment.apiUrl}/requests`);
    expect(requests.length).toBe(3);
    const filters = requests.map((r) => r.request.params.get('and') ?? '');
    expect(filters.every((f) => f.includes('assigned_agent_id.eq.agent-1'))).toBeTrue();
    expect(filters.some((f) => f.includes('status.eq.waiting_for_customer'))).toBeTrue();
    requests.forEach((r) => {
      expect(r.request.headers.get('Range')).toBe('0-0');
      r.flush([], { headers: { 'content-range': '*/2' } });
    });
    expect(rows).toEqual([jasmine.objectContaining({ active: 2, waiting: 2, urgent: 2 })]);
  });
});
