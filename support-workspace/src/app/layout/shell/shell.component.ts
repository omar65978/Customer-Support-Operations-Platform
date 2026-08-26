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

        <nav class="nav-list" aria-label="Main navigation">
          <a
            class="nav-item"
            routerLink="/dashboard"
            routerLinkActive="nav-item--active"
            id="nav-dashboard"
          >
            <mat-icon class="nav-icon">dashboard</mat-icon>
            <span class="nav-label">Dashboard</span>
          </a>
          <a
            class="nav-item"
            routerLink="/requests"
            routerLinkActive="nav-item--active"
            id="nav-requests"
          >
            <mat-icon class="nav-icon">inbox</mat-icon>
            <span class="nav-label">All Requests</span>
          </a>
          <a
            *ngIf="(currentUser$ | async)?.role === 'manager'"
            class="nav-item"
            routerLink="/manager"
            routerLinkActive="nav-item--active"
            id="nav-manager"
          >
            <mat-icon class="nav-icon">bar_chart</mat-icon>
            <span class="nav-label">Overview</span>
          </a>
        </nav>

        <div class="sidenav-footer">
          <div class="footer-divider"></div>
          <div class="user-info" *ngIf="currentUser$ | async as user">
            <div class="user-avatar" aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</div>
            <div class="user-details">
              <span class="user-name">{{ user.name }}</span>
              <span class="role-badge role-badge--{{ user.role }}">{{ user.role }}</span>
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
    :host {
      --sidebar-bg: #0f1b2d;
      --sidebar-border: rgba(255, 255, 255, 0.08);
      --nav-text: #b8c5d6;
      --nav-text-hover: #ffffff;
      --nav-icon: #7a90a8;
      --nav-icon-hover: #ffffff;
      --nav-hover-bg: rgba(255, 255, 255, 0.07);
      --nav-active-bg: #1d4ed8;
      --nav-active-text: #ffffff;
      --nav-active-icon: #ffffff;
      --nav-active-shadow: 0 2px 8px rgba(29, 78, 216, 0.45);
      --nav-focus-ring: 2px solid #60a5fa;
      --nav-focus-ring-offset: 2px;
      --brand-name-color: #f0f4f8;
      --brand-sub-color: #7a90a8;
      --brand-logo-bg: #1d4ed8;
      --brand-logo-shadow: 0 2px 8px rgba(29, 78, 216, 0.4);
      --avatar-bg: #1d4ed8;
      --user-name-color: #e2eaf3;
      --footer-bg: rgba(0, 0, 0, 0.15);
    }

    .shell-container {
      height: 100vh;
    }

    .sidenav {
      width: 256px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
    }

    .sidenav-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 22px 18px 20px;
      border-bottom: 1px solid var(--sidebar-border);
      flex-shrink: 0;
    }

    .brand-logo {
      width: 38px;
      height: 38px;
      background: var(--brand-logo-bg);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: var(--brand-logo-shadow);
    }

    .brand-logo mat-icon {
      color: #ffffff;
      font-size: 21px;
      width: 21px;
      height: 21px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .brand-name {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--brand-name-color);
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .brand-sub {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--brand-sub-color);
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }

    .nav-list {
      flex: 1;
      padding: 10px 10px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 10px 12px;
      border-radius: 8px;
      text-decoration: none;
      color: var(--nav-text);
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1;
      transition: background-color 0.14s ease, color 0.14s ease;
      outline: none;
      cursor: pointer;
    }

    .nav-item:hover {
      background: var(--nav-hover-bg);
      color: var(--nav-text-hover);
    }

    .nav-item:hover .nav-icon {
      color: var(--nav-icon-hover);
    }

    .nav-item:focus-visible {
      outline: var(--nav-focus-ring);
      outline-offset: var(--nav-focus-ring-offset);
      color: var(--nav-text-hover);
    }

    .nav-item--active {
      background: var(--nav-active-bg);
      color: var(--nav-active-text);
      box-shadow: var(--nav-active-shadow);
    }

    .nav-item--active .nav-icon {
      color: var(--nav-active-icon);
    }

    .nav-item--active:hover {
      background: var(--nav-active-bg);
      color: var(--nav-active-text);
    }

    .nav-icon {
      color: var(--nav-icon);
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      transition: color 0.14s ease;
    }

    .nav-item--active .nav-icon {
      color: var(--nav-active-icon);
    }

    .nav-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidenav-footer {
      flex-shrink: 0;
    }

    .footer-divider {
      height: 1px;
      background: var(--sidebar-border);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 14px 16px;
      background: var(--footer-bg);
    }

    .user-avatar {
      width: 34px;
      height: 34px;
      background: var(--avatar-bg);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.8125rem;
      flex-shrink: 0;
      letter-spacing: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--user-name-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
    }

    .role-badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 7px;
      border-radius: 4px;
      line-height: 1.4;
      width: fit-content;
    }

    .role-badge--agent {
      background: #1e3a5f;
      color: #93c5fd;
      border: 1px solid #2563eb;
    }

    .role-badge--manager {
      background: #2d1f4e;
      color: #c4b5fd;
      border: 1px solid #7c3aed;
    }

    .role-badge--customer {
      background: #1a3a2a;
      color: #86efac;
      border: 1px solid #16a34a;
    }

    .top-toolbar {
      background: #ffffff !important;
      border-bottom: 1px solid #e2e8f0;
      color: #0f172a !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
      height: 64px;
    }

    .toolbar-spacer {
      flex: 1;
    }

    .main-content {
      background: #f1f5f9;
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
      .page-content {
        padding: 16px;
      }

      .sidenav {
        width: 240px;
      }
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
