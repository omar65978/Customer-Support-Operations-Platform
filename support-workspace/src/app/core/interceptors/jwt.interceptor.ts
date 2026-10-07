import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

function isSupabaseRequest(url: string): boolean {
  if (!environment.supabaseUrl) return false;
  try {
    return new URL(url).origin === new URL(environment.supabaseUrl).origin;
  } catch {
    return false;
  }
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isSupabaseRequest(req.url)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthEndpoint = req.url.includes('/auth/v1/');
  const token = localStorage.getItem('token');
  let authenticatedRequest = req.clone({
    setHeaders: { apikey: environment.supabaseAnonKey },
  });

  if (!isAuthEndpoint && token && !req.headers.has('Authorization')) {
    authenticatedRequest = authenticatedRequest.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthEndpoint || !token) return throwError(() => error);

      if (localStorage.getItem('refresh_token')) {
        return auth.refreshSession().pipe(
          switchMap((session) => next(req.clone({
            setHeaders: {
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${session.accessToken}`,
            },
          }))),
          catchError((refreshError) => {
            auth.logout();
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }

      auth.logout();
      void router.navigate(['/login']);
      return throwError(() => error);
    }),
  );
};
