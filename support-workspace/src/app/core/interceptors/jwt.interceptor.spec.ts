import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { jwtInterceptor } from './jwt.interceptor';
import { environment } from '../../../environments/environment';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'a1', email: 'a@x.com', name: 'Agent', role: 'agent' }));
    localStorage.setItem('token', 'header.payload.signature');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('adds the API key and the signed-in user\'s token', () => {
    http.get(`${environment.apiUrl}/requests`).subscribe();
    const req = backend.expectOne(`${environment.apiUrl}/requests`);
    expect(req.request.headers.get('apikey')).toBe(environment.supabaseAnonKey);
    expect(req.request.headers.get('Authorization')).toBe('Bearer header.payload.signature');
    req.flush([]);
  });

  it('keeps an Authorization header that the caller set itself', () => {
    http.get(`${environment.apiUrl}/users`, { headers: { Authorization: 'Bearer sign-in-token' } }).subscribe();
    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/users`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer sign-in-token');
    req.flush([]);
  });

  it('ends an expired session and asks the user to sign in again', () => {
    http.get(`${environment.apiUrl}/requests`).subscribe({ error: () => undefined });
    backend.expectOne(`${environment.apiUrl}/requests`).flush({ message: 'JWT expired' }, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('does not sign the user out on a permission error; the page shows the message', () => {
    let status = 0;
    http.post(`${environment.apiUrl}/messages`, {}).subscribe({ error: (e) => (status = e.status) });
    backend.expectOne(`${environment.apiUrl}/messages`).flush({ message: 'permission denied' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    expect(localStorage.getItem('token')).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
