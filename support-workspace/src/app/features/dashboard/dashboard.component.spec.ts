import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { RequestsService, DEFAULT_REQUEST_QUERY } from '../../core/services/requests.service';
import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../core/models';

describe('DashboardComponent (work queue)', () => {
  let requests: jasmine.SpyObj<RequestsService>;
  let fixture: ComponentFixture<DashboardComponent>;
  const agent: User = { id: 'a1', email: 'agent1@support.com', name: 'Sarah Chen', role: 'agent' };

  beforeEach(() => {
    requests = jasmine.createSpyObj<RequestsService>('RequestsService', ['list', 'count']);
    requests.list.and.returnValue(of({ data: [], total: 0, page: 1, pageSize: 10 }));
    requests.count.and.returnValue(of(2));

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: RequestsService, useValue: requests },
        {
          provide: AuthService,
          useValue: { currentUser: agent, getStaff: () => of([agent]) },
        },
      ],
    });
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('loads the first page of the work queue on the server', () => {
    expect(requests.list).toHaveBeenCalled();
    const [query, staff, page, pageSize] = requests.list.calls.mostRecent().args;
    expect(query).toEqual(jasmine.objectContaining({ view: DEFAULT_REQUEST_QUERY.view }));
    expect(staff.id).toBe('a1');
    expect(page).toBe(1);
    expect(pageSize).toBe(10);
  });

  it('switches to a server-side view and resets to the first page', () => {
    const component = fixture.componentInstance;
    component.apply({ view: 'unassigned' });
    const [query, , page] = requests.list.calls.mostRecent().args;
    expect(query.view).toBe('unassigned');
    expect(page).toBe(1);
  });

  it('sorts on the server when a sortable column is chosen', () => {
    const component = fixture.componentInstance;
    component.onSort({ active: 'priority', direction: 'desc' });
    const [query] = requests.list.calls.mostRecent().args;
    expect(query.sortBy).toBe('urgency_rank');
    expect(query.sortDirection).toBe('desc');
  });

  it('shows counts for the other views, not counts taken from the visible page', () => {
    expect(requests.count).toHaveBeenCalled();
    expect(fixture.componentInstance.counts.attention).toBe(2);
  });
});
