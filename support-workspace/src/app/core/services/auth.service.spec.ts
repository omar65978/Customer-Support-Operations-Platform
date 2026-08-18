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
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('initializes with no user when localStorage is empty', () => {
    expect(service.currentUser).toBeNull();
    expect(service.isLoggedIn).toBeFalse();
  });

  it('restores user from localStorage on initialization', () => {
    const stored = { id: 'u3', email: 'agent1@support.com', name: 'Sarah Chen', role: 'agent', accessToken: 'token-abc' };
    localStorage.setItem('user', JSON.stringify(stored));
    localStorage.setItem('token', 'token-abc');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    const freshService = TestBed.inject(AuthService);

    expect(freshService.currentUser).not.toBeNull();
    expect(freshService.currentUser?.role).toBe('agent');
    expect(freshService.isLoggedIn).toBeTrue();
  });

  it('sets user and token in localStorage after successful login', () => {
    const credentials = { email: 'agent1@support.com', password: 'password123' };
    const mockResponse = {
      accessToken: 'jwt-token',
      user: { id: 'u3', email: 'agent1@support.com', name: 'Sarah Chen', role: 'agent' },
    };

    service.login(credentials).subscribe((res) => {
      expect(res.accessToken).toBe('jwt-token');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(service.currentUser?.id).toBe('u3');
    expect(service.isLoggedIn).toBeTrue();
  });

  it('sets manager role correctly after login', () => {
    const credentials = { email: 'manager@support.com', password: 'password123' };
    const mockResponse = {
      accessToken: 'manager-token',
      user: { id: 'u5', email: 'manager@support.com', name: 'Maria Rodriguez', role: 'manager' },
    };

    service.login(credentials).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/login`).flush(mockResponse);

    expect(service.currentUser?.role).toBe('manager');
  });

  it('clears localStorage and user state on logout', () => {
    localStorage.setItem('token', 'existing-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u3', email: 'agent1@support.com', name: 'Sarah', role: 'agent', accessToken: 'existing-token' }));

    service.logout();

    expect(service.currentUser).toBeNull();
    expect(service.isLoggedIn).toBeFalse();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('emits updated user through currentUser$ observable after login', (done) => {
    const mockResponse = {
      accessToken: 'obs-token',
      user: { id: 'u4', email: 'agent2@support.com', name: 'James Wright', role: 'agent' },
    };

    service.currentUser$.subscribe((user) => {
      if (user !== null) {
        expect(user.name).toBe('James Wright');
        done();
      }
    });

    service.login({ email: 'agent2@support.com', password: 'password123' }).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/login`).flush(mockResponse);
  });
});
