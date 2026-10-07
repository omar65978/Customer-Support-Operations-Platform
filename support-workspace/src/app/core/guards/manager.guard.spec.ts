import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { managerGuard } from './manager.guard';
import { AuthService } from '../services/auth.service';
import type { User } from '../models';

describe('managerGuard', () => {
  let router: Router;
  let authService: { initialize: jasmine.Spy; currentUser: User | null };

  beforeEach(() => {
    authService = { initialize: jasmine.createSpy('initialize'), currentUser: null };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        provideRouter([]),
      ],
    });
    router = TestBed.inject(Router);
  });

  it('allows a verified manager', async () => {
    authService.currentUser = { id: 'm1', email: 'manager@example.test', name: 'Manager', role: 'manager' };
    authService.initialize.and.returnValue(of(true));
    const result = TestBed.runInInjectionContext(() => managerGuard(null as never, null as never)) as Observable<boolean | UrlTree>;
    await expectAsync(firstValueFrom(result)).toBeResolvedTo(true);
  });

  it('redirects an agent away from manager-only areas', async () => {
    authService.currentUser = { id: 'a1', email: 'agent@example.test', name: 'Agent', role: 'agent' };
    authService.initialize.and.returnValue(of(true));
    const result = TestBed.runInInjectionContext(() => managerGuard(null as never, null as never)) as Observable<boolean | UrlTree>;
    const value = await firstValueFrom(result);
    expect(value instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(value as UrlTree)).toBe('/dashboard');
  });
});
