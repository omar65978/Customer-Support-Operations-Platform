import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, map, of } from 'rxjs';
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
    if (environment.apiUrl.includes('supabase.co')) {
      return this.http.get<User[]>(`${environment.apiUrl}/users?email=eq.${credentials.email}`).pipe(
        map(users => {
          const user = users && users.length > 0 ? users[0] : null;
          if (!user) {
            throw new Error('Invalid email or password');
          }
          const accessToken = 'supabase-mock-jwt-token-' + user.id;
          return { accessToken, user };
        }),
        tap(res => {
          localStorage.setItem('token', res.accessToken);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        })
      );
    }

    return this.http.post<{ accessToken: string; user: User }>(
      `${environment.apiUrl}/login`,
      credentials
    ).pipe(
      tap(res => {
        localStorage.setItem('token', res.accessToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUserSubject.next(res.user);
      })
    );
  }

  getAllAgents(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users?role=eq.agent`);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }
}