import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessagesService } from './messages.service';
import { environment } from '../../../environments/environment';

describe('MessagesService', () => {
  let service: MessagesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MessagesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the conversation for one request in time order', () => {
    service.getForRequest('r1').subscribe();
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/messages`);
    expect(req.request.params.get('request_id')).toBe('eq.r1');
    expect(req.request.params.get('order')).toBe('created_at.asc');
    req.flush([]);
  });

  it('sends a customer-visible reply with is_internal=false and no author fields', () => {
    service.sendMessage('r1', 'We are looking into it', false).subscribe();
    const req = http.expectOne({ method: 'POST', url: `${environment.apiUrl}/messages` });
    expect(req.request.body).toEqual({ request_id: 'r1', content: 'We are looking into it', is_internal: false });
    expect(req.request.headers.get('Prefer')).toBe('return=representation');
    req.flush([{ id: 'm1', request_id: 'r1', author_id: 'a1', author_name: 'Sarah', author_role: 'agent', content: 'x', is_internal: false, created_at: 'now' }]);
  });

  it('sends an internal note with is_internal=true', () => {
    service.sendMessage('r1', 'Billing migration locked the table', true).subscribe();
    const req = http.expectOne({ method: 'POST', url: `${environment.apiUrl}/messages` });
    expect(req.request.body.is_internal).toBeTrue();
    req.flush([{ id: 'm2', request_id: 'r1', content: 'x', is_internal: true, author_role: 'agent', created_at: 'now' }]);
  });
});
