import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  private mapSupabaseUser(rawUser: any): User {
    if (!rawUser) return rawUser;
    return {
      ...rawUser,
      name: rawUser.name || rawUser.user_metadata?.full_name || rawUser.email,
      role: rawUser.role || rawUser.user_metadata?.role || 'agent',
    };
  }

  private getStoredUser(): User | null {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return this.mapSupabaseUser(parsed);
    } catch {
      return null;
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    const url = `${environment.supabaseUrl}/auth/v1/token?grant_type=password`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'apikey': environment.supabaseKey
    });

    return this.http.post<any>(url, credentials, { headers }).pipe(
      tap(res => {
        if (res.access_token) {
          const mappedUser = this.mapSupabaseUser(res.user);
          localStorage.setItem('token', res.access_token);
          localStorage.setItem('user', JSON.stringify(mappedUser));
          this.currentUserSubject.next(mappedUser);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }
}