import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const managerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.initialize().pipe(
    map((isAuthorized) => isAuthorized && auth.currentUser?.role === 'manager'
      ? true
      : router.createUrlTree(['/dashboard'])),
  );
};
