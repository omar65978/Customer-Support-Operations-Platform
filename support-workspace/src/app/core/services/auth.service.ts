import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, tap } from 'rxjs';
import type { AuthUser, LoginCredentials, User } from '../models';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://iaukydzbcdmglqajllei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AqWrf6GufnWU-Esd3MkLvQ_xoGFCUlL";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

@Injectable({ providedIn: 'root' })
export class AuthService {
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

  login(credentials: LoginCredentials): Observable<any> {
    return from(
      supabase
        .from('users')
        .select('*')
        .eq('email', credentials.email)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          throw new Error('Invalid email or password');
        }
        return data;
      }),
      tap((data) => {
        const token = 'mock-supabase-token-' + data.id;
        const user: AuthUser = {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role as AuthUser['role'],
          accessToken: token,
        };
        localStorage.setItem('token', token);
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
    return from(
      supabase
        .from('users')
        .select('*')
        .eq('role', 'agent')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []) as User[];
      })
    );
  }

  private clearStorage(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}