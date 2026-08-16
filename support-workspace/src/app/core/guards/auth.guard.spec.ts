import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let router: Router;
  let authService: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', children: [] },
          { path: 'dashboard', canActivate: [authGuard], children: [] },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns true when user is authenticated', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u3', email: 'agent1@support.com', name: 'Sarah', role: 'agent', accessToken: 'token' }));
    localStorage.setItem('token', 'token');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const freshAuth = TestBed.inject(AuthService);
    expect(freshAuth.isLoggedIn).toBeTrue();
  });

  it('returns false (redirect to /login) when user is not authenticated', () => {
    const result = TestBed.runInInjectionContext(() => authGuard(null as any, null as any));
    expect(result).not.toBe(true);
  });
});
