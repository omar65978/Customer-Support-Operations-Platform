import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import type { AuthUser, LoginCredentials, User } from '../models';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (stored && token) {
      try {
        const user = JSON.parse(stored) as AuthUser;
        this.currentUserSubject.next({ ...user, accessToken: token });
      } catch {
        this.clearStorage();
      }
    }
  }

  get currentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  get token(): string | null {
    return localStorage.getItem('token');
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/login`, credentials).pipe(
      tap((res) => {
        const user: AuthUser = {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          role: res.user.role as AuthUser['role'],
          accessToken: res.accessToken,
        };
        localStorage.setItem('token', res.accessToken);
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }

  logout(): void {
    this.clearStorage();
    this.currentUserSubject.next(null);
  }

  getAllAgents(): Observable<User[]> {
    const params = new HttpParams().set('role', 'agent');
    return this.http.get<User[]>(`${environment.apiUrl}/users`, { params }).pipe(
      map((users) => users.filter((u) => u.role === 'agent'))
    );
  }

  private clearStorage(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
