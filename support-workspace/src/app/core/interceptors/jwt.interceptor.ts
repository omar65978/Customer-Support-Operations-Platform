import { HttpInterceptorFn } from '@angular/common/http';

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

  return next(clonedReq);
};