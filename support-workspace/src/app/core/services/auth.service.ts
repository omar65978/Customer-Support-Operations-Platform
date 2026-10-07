import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getStoredUser(): User | null {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try { return JSON.parse(stored) as User; } catch { return null; }
  }

  public get currentUser(): User | null { return this.currentUserSubject.value; }

  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value && !!localStorage.getItem('token');
  }

  login(credentials: { email: string; password: string }): Observable<{ accessToken: string; user: User }> {
    return this.http.post<any>(
      `${environment.supabaseUrl}/auth/v1/token?grant_type=password`,
      credentials,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey
        }
      }
    ).pipe(
      map(response => {
        const supaUser = response.user;
        const user: User = {
          id: supaUser.id,
          email: supaUser.email,
          name: supaUser.user_metadata?.full_name || supaUser.email,
          role: supaUser.user_metadata?.role || 'agent'
        };
        return { accessToken: response.access_token, user };
      }),
      tap(res => {
        localStorage.setItem('token', res.accessToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
      })
    );
  }

  getAllAgents(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users?role=eq.agent&select=id,email,name,role`);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }
}