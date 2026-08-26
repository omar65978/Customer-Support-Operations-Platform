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
    service.sendMessage('r1', 'Hello customer', false).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1/messages`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.isInternal).toBeFalse();
    expect(req.request.body.content).toBe('Hello customer');
    req.flush({});
  });

  it('sendMessage posts with isInternal=true for internal note', () => {
    service.sendMessage('r1', 'Internal team note', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/requests/r1/messages`);
    expect(req.request.body.isInternal).toBeTrue();
    req.flush({});
  });
});
