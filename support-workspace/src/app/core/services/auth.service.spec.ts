import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, STAFF_ONLY_MESSAGE } from './auth.service';
import { AccountError } from '../utils/errors';
import { environment } from '../../../environments/environment';

const TOKEN_URL = `${environment.supabaseUrl}/auth/v1/token?grant_type=password`;
const PROFILE_URL = `${environment.apiUrl}/users`;

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  function setup(): void {
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('starts signed out when nothing is stored', () => {
    setup();
    expect(service.currentUser).toBeNull();
    expect(service.isLoggedIn).toBeFalse();
  });

  it('takes the role from the users table, not from sign-in metadata', () => {
    setup();
    let signedIn: { role: string } | undefined;
    service.login({ email: 'sarah@support.com', password: 'pw' }).subscribe((u) => (signedIn = u));

    http.expectOne(TOKEN_URL).flush({
      access_token: 'token-a',
      user: { id: 'agent-1', user_metadata: { role: 'customer' } },
    });
    const profile = http.expectOne((r) => r.url === PROFILE_URL);
    expect(profile.request.params.get('id')).toBe('eq.agent-1');
    profile.flush([{ id: 'agent-1', email: 'sarah@support.com', name: 'Sarah Chen', role: 'agent' }]);

    expect(signedIn?.role).toBe('agent');
    expect(service.isLoggedIn).toBeTrue();
    expect(localStorage.getItem('token')).toBe('token-a');
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').role).toBe('agent');
  });

  it('refuses a customer account and stores nothing', () => {
    setup();
    let error: unknown;
    service.login({ email: 'alice@example.com', password: 'pw' }).subscribe({ error: (e) => (error = e) });

    http.expectOne(TOKEN_URL).flush({ access_token: 'customer-token', user: { id: 'c1' } });
    http.expectOne((r) => r.url === PROFILE_URL).flush([{ id: 'c1', email: 'alice@example.com', name: 'Alice', role: 'customer' }]);
    // Best-effort sign-out of the rejected session.
    http.expectOne(`${environment.supabaseUrl}/auth/v1/logout`).flush({});

    expect(error).toBeInstanceOf(AccountError);
    expect((error as Error).message).toBe(STAFF_ONLY_MESSAGE);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(service.isLoggedIn).toBeFalse();
  });

  it('explains a wrong password in plain language', () => {
    setup();
    let error: unknown;
    service.login({ email: 'sarah@support.com', password: 'bad' }).subscribe({ error: (e) => (error = e) });
    http.expectOne(TOKEN_URL).flush({ error_description: 'Invalid login credentials' }, { status: 400, statusText: 'Bad Request' });
    expect((error as Error).message).toMatch(/invalid email or password/i);
  });

  it('discards a stored customer session on start-up', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'c1', email: 'alice@example.com', name: 'Alice', role: 'customer' }));
    localStorage.setItem('token', 'customer-token');
    setup();
    expect(service.currentUser).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('restores a stored staff session on start-up', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'm1', email: 'maria@support.com', name: 'Maria', role: 'manager' }));
    localStorage.setItem('token', 'manager-token');
    setup();
    expect(service.currentUser?.role).toBe('manager');
    expect(service.isLoggedIn).toBeTrue();
  });

  it('logout clears the stored session', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'a1', email: 'a@x.com', name: 'Agent', role: 'agent' }));
    localStorage.setItem('token', 'agent-token');
    setup();
    service.logout();
    http.expectOne(`${environment.supabaseUrl}/auth/v1/logout`).flush({});
    expect(service.currentUser).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
