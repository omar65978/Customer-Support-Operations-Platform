import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdWt5ZHpiY2RtZ2xxYWpsbGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNjQzMzIsImV4cCI6MjEwMjg0MDMzMn0.GxvoOvmGBpVUOeRC2G3nN3POzX02KGD33hmh7joN_dc";

  const isValidJwt = token && token.split('.').length === 3;

  const clonedReq = req.clone({
    setHeaders: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': isValidJwt ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // إذا انتهت صلاحية التوكن (PGRST303) أو حدث خطأ صلاحيات (401/403)
      if (error.error?.code === 'PGRST303' || error.status === 401 || error.status === 403) {
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