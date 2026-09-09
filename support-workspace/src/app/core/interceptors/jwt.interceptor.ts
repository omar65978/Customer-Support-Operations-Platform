import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const isValidJwt = token && token.split('.').length === 3;

  const clonedReq = req.clone({
    setHeaders: {
      'apikey': environment.supabaseAnonKey,
      'Authorization': isValidJwt ? `Bearer ${token}` : `Bearer ${environment.supabaseAnonKey}`
    }
  });

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        if (!window.location.pathname.includes('/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
      return throwError(() => error);
    })
  );
};