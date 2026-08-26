import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { managerGuard } from './core/guards/manager.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'requests/:id',
        loadComponent: () =>
          import('./features/requests/request-detail/request-detail.component').then(
            (m) => m.RequestDetailComponent
          ),
      },
      {
        path: 'manager',
        loadComponent: () =>
          import('./features/manager/manager-dashboard.component').then(
            (m) => m.ManagerDashboardComponent
          ),
        canActivate: [managerGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
