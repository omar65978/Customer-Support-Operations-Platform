import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  
  const headersConfig: Record<string, string> = {
    'apikey': environment.supabaseKey,
  };

  if (token) {
    headersConfig['Authorization'] = `Bearer ${token}`;
  }

  const clonedReq = req.clone({
    setHeaders: headersConfig
  });

  return next(clonedReq);
};