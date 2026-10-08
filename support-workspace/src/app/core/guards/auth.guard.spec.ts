import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { managerGuard } from './manager.guard';

function store(user: object): void {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'a.b.c');
}

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => localStorage.clear());

  function runGuard(guard: typeof authGuard) {
    return TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  }

  it('lets an agent into the workspace', () => {
    store({ id: 'a1', email: 'a@x.com', name: 'Agent', role: 'agent' });
    expect(runGuard(authGuard)).toBeTrue();
  });

  it('sends a signed-out visitor to the login page', () => {
    const result = runGuard(authGuard);
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('sends a stored customer session to the login page', () => {
    store({ id: 'c1', email: 'alice@example.com', name: 'Alice', role: 'customer' });
    const result = runGuard(authGuard);
    expect(result instanceof UrlTree).toBeTrue();
  });

  it('lets only managers into the overview', () => {
    store({ id: 'm1', email: 'm@x.com', name: 'Maria', role: 'manager' });
    expect(runGuard(managerGuard)).toBeTrue();
  });

  it('keeps agents out of the overview', () => {
    store({ id: 'a1', email: 'a@x.com', name: 'Agent', role: 'agent' });
    const result = runGuard(managerGuard);
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});
