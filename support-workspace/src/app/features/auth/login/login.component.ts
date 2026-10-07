import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <div class="login-container">
      <div class="login-bg"></div>
      <div class="login-content">
        <div class="brand-header">
          <div class="brand-icon">
            <mat-icon>support_agent</mat-icon>
          </div>
          <h1>Support Workspace</h1>
          <p>Sign in to manage customer requests</p>
        </div>

        <mat-card class="login-card">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="onSubmit()" id="login-form">
              <div *ngIf="errorMessage" class="error-alert" role="alert">
                <mat-icon>error_outline</mat-icon>
                {{ errorMessage }}
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email address</mat-label>
                <input
                  matInput
                  type="email"
                  formControlName="email"
                  id="login-email"
                  placeholder="agent@support.com"
                  autocomplete="email"
                />
                <mat-icon matPrefix>email</mat-icon>
                <mat-error *ngIf="form.get('email')?.hasError('required')">Email is required</mat-error>
                <mat-error *ngIf="form.get('email')?.hasError('email')">Enter a valid email address</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Password</mat-label>
                <input
                  matInput
                  [type]="showPassword ? 'text' : 'password'"
                  formControlName="password"
                  id="login-password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
                <mat-icon matPrefix>lock</mat-icon>
                <button mat-icon-button matSuffix type="button" (click)="showPassword = !showPassword">
                  <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-error *ngIf="form.get('password')?.hasError('required')">Password is required</mat-error>
              </mat-form-field>

              <button
                mat-flat-button
                color="primary"
                type="submit"
                id="login-submit"
                class="full-width submit-btn"
                [disabled]="isSubmitting"
              >
                <mat-spinner diameter="20" *ngIf="isSubmitting"></mat-spinner>
                <span *ngIf="!isSubmitting">Sign in</span>
              </button>
            </form>
          </mat-card-content>
        </mat-card>

        <div class="demo-credentials">
          <p class="demo-title">Demo accounts</p>
          <p>agent1&#64;support.com · password123</p>
          <p>manager&#64;support.com · password123</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%);
    }

    .login-bg {
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%);
    }

    .login-content {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 420px;
      padding: 1rem;
    }

    .brand-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .brand-icon {
      width: 64px;
      height: 64px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      backdrop-filter: blur(10px);
    }

    .brand-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    .brand-header h1 {
      color: white;
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
    }

    .brand-header p {
      color: rgba(255,255,255,0.7);
      margin: 0;
    }

    .login-card {
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px !important;
      border: 1px solid rgba(255,255,255,0.3);
      box-shadow: 0 25px 50px rgba(0,0,0,0.3) !important;
    }

    mat-card-content {
      padding: 2rem !important;
    }

    .full-width {
      width: 100%;
    }

    .submit-btn {
      height: 48px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 12px !important;
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .demo-credentials {
      margin-top: 1.5rem;
      padding: 1rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      text-align: center;
      color: rgba(255,255,255,0.6);
      font-size: 0.8125rem;
    }

    .demo-title {
      color: rgba(255,255,255,0.9);
      font-weight: 600;
      margin-bottom: 4px;
    }

    .demo-credentials p { margin: 2px 0; }
  `],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  isSubmitting = false;
  showPassword = false;
  errorMessage = '';

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = '';
    const { email, password } = this.form.value as { email: string; password: string };
    this.auth.login({ email, password }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.errorMessage = 'Invalid email or password. Please try again.';
        this.isSubmitting = false;
      },
    });
  }
}
