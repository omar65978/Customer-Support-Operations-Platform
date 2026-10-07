import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let router: Router;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['initialize']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        provideRouter([]),
      ],
    });
    router = TestBed.inject(Router);
  });

  it('allows entry only after session initialization verifies staff authorization', async () => {
    authService.initialize.and.returnValue(of(true));
    const result = TestBed.runInInjectionContext(() => authGuard(null as never, null as never)) as Observable<boolean | UrlTree>;
    await expectAsync(firstValueFrom(result)).toBeResolvedTo(true);
  });

  it('redirects to login when session initialization does not authenticate the user', async () => {
    authService.initialize.and.returnValue(of(false));
    const result = TestBed.runInInjectionContext(() => authGuard(null as never, null as never)) as Observable<boolean | UrlTree>;
    const value = await firstValueFrom(result);
    expect(value instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(value as UrlTree)).toBe('/login');
  });
});
