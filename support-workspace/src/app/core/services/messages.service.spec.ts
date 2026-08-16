import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MessagesService } from './messages.service';
import { environment } from '../../../environments/environment';

describe('MessagesService', () => {
  let service: MessagesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessagesService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MessagesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getForRequest fetches messages filtered by requestId', () => {
    service.getForRequest('r1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/messages?requestId=r1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('sendMessage posts with isInternal=false for customer-visible reply', () => {
    service.sendMessage('r1', 'Hello customer', 'u3', 'Sarah Chen', 'agent', false).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.isInternal).toBeFalse();
    expect(req.request.body.content).toBe('Hello customer');
    req.flush({});
  });

  it('sendMessage posts with isInternal=true for internal note', () => {
    service.sendMessage('r1', 'Internal team note', 'u3', 'Sarah Chen', 'agent', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/messages`);
    expect(req.request.body.isInternal).toBeTrue();
    req.flush({});
  });

  it('sendMessage includes requestId, authorId, authorName, authorRole', () => {
    service.sendMessage('r1', 'Test content', 'u3', 'Sarah Chen', 'agent', false).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/messages`);
    expect(req.request.body).toEqual(jasmine.objectContaining({
      requestId: 'r1',
      authorId: 'u3',
      authorName: 'Sarah Chen',
      authorRole: 'agent',
    }));
    req.flush({});
  });

  it('internal notes use isInternal=true — distinguishing from customer messages', () => {
    service.sendMessage('r1', 'Billing table locked', 'u5', 'Maria', 'manager', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/messages`);
    const body = req.request.body;
    expect(body.isInternal).toBeTrue();
    expect(body.authorRole).toBe('manager');
    req.flush({});
  });
});
