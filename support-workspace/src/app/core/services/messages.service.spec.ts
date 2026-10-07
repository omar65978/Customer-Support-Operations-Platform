import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MessagesService } from './messages.service';
import { environment } from '../../../environments/environment';

describe('MessagesService', () => {
  let service: MessagesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'u3', email: 'agent1@support.com', name: 'Sarah Chen', role: 'agent' }));
    localStorage.setItem('token', 'test-jwt');

    TestBed.configureTestingModule({
      providers: [MessagesService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MessagesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getForRequest fetches messages filtered by request_id', () => {
    service.getForRequest('r1').subscribe(msgs => {
      expect(msgs.length).toBe(1);
      expect(msgs[0].requestId).toBe('r1');
      expect(msgs[0].authorName).toBe('Alice');
    });

    const req = httpMock.expectOne(r =>
      r.url.includes('/messages') &&
      r.url.includes('request_id=eq.r1')
    );
    expect(req.request.method).toBe('GET');
    req.flush([{
      id: 'm1', request_id: 'r1', author_id: 'c1', author_name: 'Alice',
      author_role: 'customer', content: 'Help!', is_internal: false, created_at: '2024-01-01'
    }]);
  });

  it('sendMessage posts with is_internal=false for customer-visible reply', () => {
    service.sendMessage('r1', 'Thanks for reaching out', false).subscribe(msg => {
      expect(msg.content).toBe('Thanks for reaching out');
      expect(msg.isInternal).toBeFalse();
    });

    const req = httpMock.expectOne(r =>
      r.url.includes('/messages') &&
      r.method === 'POST'
    );
    expect(req.request.body.request_id).toBe('r1');
    expect(req.request.body.is_internal).toBeFalse();
    expect(req.request.body.author_id).toBe('u3');
    expect(req.request.headers.get('Prefer')).toBe('return=representation');
    req.flush([{
      id: 'm2', request_id: 'r1', author_id: 'u3', author_name: 'Sarah Chen',
      author_role: 'agent', content: 'Thanks for reaching out', is_internal: false, created_at: '2024-01-01'
    }]);
  });

  it('sendMessage posts with is_internal=true for internal note', () => {
    service.sendMessage('r1', 'Internal team note', true).subscribe(msg => {
      expect(msg.isInternal).toBeTrue();
    });

    const req = httpMock.expectOne(r => r.method === 'POST' && r.url.includes('/messages'));
    expect(req.request.body.is_internal).toBeTrue();
    req.flush([{
      id: 'm3', request_id: 'r1', author_id: 'u3', author_name: 'Sarah Chen',
      author_role: 'agent', content: 'Internal team note', is_internal: true, created_at: '2024-01-01'
    }]);
  });
});
