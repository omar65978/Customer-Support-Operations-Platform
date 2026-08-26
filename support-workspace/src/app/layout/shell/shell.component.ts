import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay } from 'rxjs';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatMenuModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    <mat-sidenav-container class="shell-container">
      <mat-sidenav
        #sidenav
        [mode]="(isHandset$ | async) ? 'over' : 'side'"
        [opened]="!(isHandset$ | async)"
        class="sidenav"
      >
        <div class="sidenav-brand">
          <div class="brand-logo">
            <mat-icon>support_agent</mat-icon>
          </div>
          <div class="brand-text">
            <span class="brand-name">SupportDesk</span>
            <span class="brand-sub">Workspace</span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <mat-nav-list class="nav-list">
          <a
            mat-list-item
            routerLink="/dashboard"
            routerLinkActive="active-link"
            id="nav-dashboard"
          >
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a
            mat-list-item
            routerLink="/requests"
            routerLinkActive="active-link"
            id="nav-requests"
          >
            <mat-icon matListItemIcon>inbox</mat-icon>
            <span matListItemTitle>All Requests</span>
          </a>
        </mat-nav-list>

        <div class="sidenav-footer">
          <mat-divider></mat-divider>
          <div class="user-info" *ngIf="currentUser$ | async as user">
            <div class="user-avatar">{{ user.name.charAt(0).toUpperCase() }}</div>
            <div class="user-details">
              <span class="user-name">{{ user.name }}</span>
              <mat-chip class="role-chip role-{{ user.role }}">{{ user.role }}</mat-chip>
            </div>
          </div>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="main-content">
        <mat-toolbar class="top-toolbar" color="primary">
          <button
            mat-icon-button
            *ngIf="isHandset$ | async"
            (click)="sidenav.toggle()"
            aria-label="Toggle navigation"
          >
            <mat-icon>menu</mat-icon>
          </button>
          <span class="toolbar-spacer"></span>
          <button
            mat-icon-button
            [matMenuTriggerFor]="userMenu"
            id="user-menu-btn"
            aria-label="User menu"
          >
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="menu-user-header" *ngIf="currentUser$ | async as user">
              <p class="menu-user-name">{{ user.name }}</p>
              <p class="menu-user-email">{{ user.email }}</p>
            </div>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="logout()" id="logout-btn">
              <mat-icon>logout</mat-icon>
              Sign out
            </button>
          </mat-menu>
        </mat-toolbar>

        <div class="page-content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .shell-container {
      height: 100vh;
    }

    .sidenav {
      width: 260px;
      background: #1e293b;
      border-right: 1px solid #334155;
    }

    .sidenav-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
      border-bottom: 1px solid #334155;
    }

    .brand-logo {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
    }

    .brand-logo mat-icon {
      color: white;
      font-size: 22px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-name {
      font-size: 1rem;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.2;
    }

    .brand-sub {
      font-size: 0.68rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .nav-list {
      padding: 12px 8px;
    }

    mat-nav-list a {
      color: #cbd5e1 !important;
      border-radius: 8px !important;
      margin-bottom: 2px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }

    mat-nav-list a:hover {
      background: #334155 !important;
      color: #f1f5f9 !important;
    }

    mat-nav-list a.active-link {
      background: #4f46e5 !important;
      color: #ffffff !important;
      box-shadow: 0 2px 6px rgba(79,70,229,0.35);
    }

    mat-nav-list mat-icon {
      color: inherit !important;
    }

    .sidenav-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #334155;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .user-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .role-chip {
      font-size: 0.65rem !important;
      height: 18px !important;
      padding: 0 8px !important;
      min-height: unset !important;
      margin-top: 2px;
    }

    .role-agent { background: rgba(99,102,241,0.25) !important; color: #a5b4fc !important; }
    .role-manager { background: rgba(168,85,247,0.25) !important; color: #d8b4fe !important; }

    .top-toolbar {
      background: white !important;
      border-bottom: 1px solid #e2e8f0;
      color: #0f172a !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
      height: 64px;
    }

    .toolbar-spacer { flex: 1; }

    .main-content {
      background: #f8fafc;
    }

    .page-content {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .menu-user-header {
      padding: 12px 16px;
    }

    .menu-user-name {
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 2px;
      font-size: 0.875rem;
    }

    .menu-user-email {
      color: #64748b;
      margin: 0;
      font-size: 0.8rem;
    }

    @media (max-width: 599px) {
      .page-content { padding: 16px; }
    }
  `],
})
export class ShellComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  currentUser$ = this.auth.currentUser$;

  isHandset$ = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay()
  );

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
