import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    environment.supabaseUrl = 'https://support.test';
    environment.apiUrl = 'https://support.test/rest/v1';
    environment.supabaseAnonKey = 'public-anon-key';
    environment.isSupabaseConfigured = true;
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts without treating a cached browser user as authenticated', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u3', role: 'manager' }));
    expect(service.currentUser).toBeNull();
    expect(service.isLoggedIn).toBeFalse();
  });

  it('verifies the access token and loads the authoritative role from profiles on restore', () => {
    localStorage.setItem('token', 'persisted-token');
    localStorage.setItem('refresh_token', 'persisted-refresh');
    let authorized = false;
    service.initialize().subscribe((result) => { authorized = result; });

    const authRequest = httpMock.expectOne('https://support.test/auth/v1/user');
    expect(authRequest.request.headers.get('Authorization')).toBe('Bearer persisted-token');
    authRequest.flush({ id: 'u3', email: 'agent@example.test', user_metadata: { role: 'manager' } });

    const profileRequest = httpMock.expectOne((request) => request.url.includes('/rest/v1/profiles'));
    expect(profileRequest.request.headers.get('Authorization')).toBe('Bearer persisted-token');
    profileRequest.flush([{ id: 'u3', full_name: 'Sarah Chen', role: 'agent' }]);

    expect(authorized).toBeTrue();
    expect(service.currentUser?.role).toBe('agent');
    expect(service.currentUser?.name).toBe('Sarah Chen');
    expect(service.isLoggedIn).toBeTrue();
  });

  it('uses the profile role instead of user-editable auth metadata during login', () => {
    let loggedInRole = '';
    service.login({ email: 'agent@example.test', password: 'password123' }).subscribe((session) => {
      loggedInRole = session.user.role;
      expect(session.accessToken).toBe('agent-token');
      expect(localStorage.getItem('token')).toBe('agent-token');
      expect(localStorage.getItem('refresh_token')).toBe('agent-refresh');
    });

    const authRequest = httpMock.expectOne((request) => request.url.includes('/auth/v1/token'));
    expect(authRequest.request.method).toBe('POST');
    expect(authRequest.request.headers.get('apikey')).toBe('public-anon-key');
    authRequest.flush({
      access_token: 'agent-token',
      refresh_token: 'agent-refresh',
      user: { id: 'u3', email: 'agent@example.test', user_metadata: { full_name: 'Untrusted', role: 'manager' } },
    });

    const profileRequest = httpMock.expectOne((request) => request.url.includes('/rest/v1/profiles'));
    profileRequest.flush([{ id: 'u3', full_name: 'Sarah Chen', role: 'agent' }]);

    expect(loggedInRole).toBe('agent');
    expect(service.currentUser?.name).toBe('Sarah Chen');
  });

  it('rejects customer profiles from the staff workspace', () => {
    let loginError = '';
    service.login({ email: 'customer@example.test', password: 'password123' }).subscribe({
      error: (error: Error) => { loginError = error.message; },
    });
    httpMock.expectOne((request) => request.url.includes('/auth/v1/token')).flush({
      access_token: 'customer-token',
      refresh_token: 'customer-refresh',
      user: { id: 'u1', email: 'customer@example.test' },
    });
    httpMock.expectOne((request) => request.url.includes('/rest/v1/profiles')).flush([
      { id: 'u1', full_name: 'Customer One', role: 'customer' },
    ]);

    expect(loginError).toContain('support employees only');
    expect(service.currentUser).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('revokes the active Supabase session and clears local state on logout', () => {
    localStorage.setItem('token', 'active-token');
    localStorage.setItem('refresh_token', 'active-refresh');
    localStorage.setItem('user', JSON.stringify({ id: 'u3', role: 'agent' }));

    service.logout();

    const request = httpMock.expectOne('https://support.test/auth/v1/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer active-token');
    request.flush(null);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(service.currentUser).toBeNull();
  });
});
