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
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
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
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'agent1@support.com', name: 'Sarah', role: 'agent' }));
    localStorage.setItem('token', 'valid-jwt-token');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    const freshService = TestBed.inject(AuthService);
    expect(freshService.currentUser).toBeTruthy();
    expect(freshService.currentUser?.email).toBe('agent1@support.com');
    expect(freshService.isLoggedIn).toBeTrue();
  });

  it('sets user and token in localStorage after successful login', () => {
    service.login({ email: 'agent1@support.com', password: 'password123' }).subscribe(res => {
      expect(res.accessToken).toBe('test-jwt');
      expect(res.user.email).toBe('agent1@support.com');
      expect(localStorage.getItem('token')).toBe('test-jwt');
    });

    const req = httpMock.expectOne(r => r.url.includes('/auth/v1/token'));
    expect(req.request.method).toBe('POST');
    req.flush({
      access_token: 'test-jwt',
      user: { id: 'u3', email: 'agent1@support.com', user_metadata: { full_name: 'Sarah Chen', role: 'agent' } }
    });
  });

  it('sets manager role correctly after login', () => {
    service.login({ email: 'manager@support.com', password: 'password123' }).subscribe(res => {
      expect(res.user.role).toBe('manager');
      expect(res.user.name).toBe('Maria Rodriguez');
    });

    const req = httpMock.expectOne(r => r.url.includes('/auth/v1/token'));
    req.flush({
      access_token: 'mgr-jwt',
      user: { id: 'u5', email: 'manager@support.com', user_metadata: { full_name: 'Maria Rodriguez', role: 'manager' } }
    });
  });

  it('clears localStorage and user state on logout', () => {
    localStorage.setItem('token', 'some-token');
    localStorage.setItem('user', '{}');
    service.logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(service.currentUser).toBeNull();
  });

  it('emits updated user through currentUser$ observable after login', () => {
    let emittedUser: any = null;
    service.currentUser$.subscribe(u => emittedUser = u);

    service.login({ email: 'agent1@support.com', password: 'pass' }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/auth/v1/token'));
    req.flush({
      access_token: 'jwt',
      user: { id: 'u3', email: 'agent1@support.com', user_metadata: { full_name: 'Sarah', role: 'agent' } }
    });

    expect(emittedUser).toBeTruthy();
    expect(emittedUser.email).toBe('agent1@support.com');
  });
});
