import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Adds the Supabase API key and the user's access token to each request. Headers that a
 * service sets itself (for example during sign-in) are kept as they are.
 * Only an expired or invalid session (401) signs the user out. Permission (403) and
 * validation errors are passed on to the page, which shows them.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = localStorage.getItem('token');
  const hasSession = !!token && token.split('.').length === 3;

  let request = req;
  if (!req.headers.has('apikey')) {
    request = request.clone({ setHeaders: { apikey: environment.supabaseAnonKey } });
  }
  if (!req.headers.has('Authorization')) {
    request = request.clone({
      setHeaders: { Authorization: `Bearer ${hasSession ? token : environment.supabaseAnonKey}` },
    });
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && hasSession) {
        auth.expireSession();
        void router.navigate(['/login'], { queryParams: { reason: 'expired' } });
      }
      return throwError(() => error);
    })
  );
};
