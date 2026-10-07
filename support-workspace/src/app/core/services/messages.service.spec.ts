import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
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

  it('queries messages for one request in chronological order', () => {
    service.getForRequest('r1').subscribe((messages) => {
      expect(messages.length).toBe(1);
      expect(messages[0].requestId).toBe('r1');
      expect(messages[0].authorName).toBe('Alice');
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/messages'));
    expect(request.request.params.get('request_id')).toBe('eq.r1');
    expect(request.request.params.get('order')).toBe('created_at.asc');
    request.flush([{
      id: 'm1', request_id: 'r1', author_id: 'c1', author_name: 'Alice',
      author_role: 'customer', content: 'Help!', is_internal: false, created_at: '2024-01-01',
    }]);
  });

  it('sends only message intent and leaves authorship to the database', () => {
    service.sendMessage('r1', 'Thanks for reaching out', false).subscribe((message) => {
      expect(message.content).toBe('Thanks for reaching out');
      expect(message.isInternal).toBeFalse();
      expect(message.authorId).toBe('u3');
    });
    const request = httpMock.expectOne((candidate) => candidate.url.includes('/messages') && candidate.method === 'POST');
    expect(request.request.body).toEqual({ request_id: 'r1', content: 'Thanks for reaching out', is_internal: false });
    expect(request.request.headers.get('Prefer')).toBe('return=representation');
    request.flush([{
      id: 'm2', request_id: 'r1', author_id: 'u3', author_name: 'Sarah Chen',
      author_role: 'agent', content: 'Thanks for reaching out', is_internal: false, created_at: '2024-01-01',
    }]);
  });

  it('allows a support agent to request an internal note', () => {
    service.sendMessage('r1', 'Internal team note', true).subscribe((message) => {
      expect(message.isInternal).toBeTrue();
    });
    const request = httpMock.expectOne((candidate) => candidate.method === 'POST' && candidate.url.includes('/messages'));
    expect(request.request.body.is_internal).toBeTrue();
    expect(request.request.body.author_role).toBeUndefined();
    request.flush([{
      id: 'm3', request_id: 'r1', author_id: 'u3', author_name: 'Sarah Chen',
      author_role: 'agent', content: 'Internal team note', is_internal: true, created_at: '2024-01-01',
    }]);
  });

  it('does not pretend an empty insert response was successful', () => {
    let errorMessage = '';
    service.sendMessage('r1', 'A sufficiently detailed reply', false).subscribe({
      error: (error: Error) => { errorMessage = error.message; },
    });
    httpMock.expectOne((candidate) => candidate.method === 'POST' && candidate.url.includes('/messages')).flush([]);
    expect(errorMessage).toContain('Message was not saved');
  });
});
