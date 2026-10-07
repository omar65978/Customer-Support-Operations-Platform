import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { jwtInterceptor } from './jwt.interceptor';
import { environment } from '../../../environments/environment';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    environment.supabaseUrl = 'https://support.test';
    environment.apiUrl = 'https://support.test/rest/v1';
    environment.supabaseAnonKey = 'public-anon-key';
    environment.isSupabaseConfigured = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches the anon key and verified session token to Supabase API calls', () => {
    localStorage.setItem('token', 'customer-session-token');
    http.get('https://support.test/rest/v1/requests').subscribe();

    const request = httpMock.expectOne('https://support.test/rest/v1/requests');
    expect(request.request.headers.get('apikey')).toBe('public-anon-key');
    expect(request.request.headers.get('Authorization')).toBe('Bearer customer-session-token');
    request.flush([]);
  });

  it('does not attach Supabase credentials to a different origin with a similar hostname', () => {
    localStorage.setItem('token', 'customer-session-token');
    http.get('https://support.test.attacker.invalid/collect').subscribe();

    const request = httpMock.expectOne('https://support.test.attacker.invalid/collect');
    expect(request.request.headers.has('apikey')).toBeFalse();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('keeps the session when an authenticated request is forbidden', () => {
    localStorage.setItem('token', 'customer-session-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'agent' }));
    http.get('https://support.test/rest/v1/requests').subscribe({ error: () => undefined });

    const request = httpMock.expectOne('https://support.test/rest/v1/requests');
    request.flush({}, { status: 403, statusText: 'Forbidden' });
    expect(localStorage.getItem('token')).toBe('customer-session-token');
    expect(localStorage.getItem('user')).not.toBeNull();
  });
});
