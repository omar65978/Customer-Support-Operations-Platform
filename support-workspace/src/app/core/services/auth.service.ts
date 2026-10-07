import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, switchMap, tap, throwError, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User, UserRole } from '../models';

interface SupabaseAuthUser {
  id: string;
  email: string;
}

interface SupabaseProfile {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface UserSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private sessionInitialized = false;
  private initialization?: Observable<boolean>;
  private refreshInProgress?: Observable<UserSession>;

  constructor(private http: HttpClient) {}

  public get currentUser(): User | null { return this.currentUserSubject.value; }

  public get isLoggedIn(): boolean {
    return this.isStaff(this.currentUser) && Boolean(localStorage.getItem('token'));
  }

  private isStaff(user: User | null): boolean {
    return user?.role === 'agent' || user?.role === 'manager';
  }

  private configuredError(): Error {
    return new Error('Supabase is not configured. Copy support-workspace/.env.example to .env and set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  private saveSession(session: UserSession): void {
    localStorage.setItem('token', session.accessToken);
    localStorage.setItem('refresh_token', session.refreshToken);
    localStorage.setItem('user', JSON.stringify(session.user));
    this.currentUserSubject.next(session.user);
  }

  private clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  private loadProfile(authUser: SupabaseAuthUser, accessToken: string, refreshToken: string): Observable<UserSession> {
    return this.http.get<SupabaseProfile[]>(`${environment.apiUrl}/profiles`, {
      params: { id: `eq.${authUser.id}`, select: 'id,full_name,role' },
      headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }),
    }).pipe(
      map((profiles) => {
        const profile = profiles[0];
        if (!profile || profile.id !== authUser.id || !['customer', 'agent', 'manager'].includes(profile.role)) {
          throw new Error('Your account profile is not set up for Support Workspace access.');
        }
        const user: User = {
          id: profile.id,
          email: authUser.email,
          name: profile.full_name,
          role: profile.role,
        };
        if (!this.isStaff(user)) throw new Error('This application is for support employees only.');
        return { user, accessToken, refreshToken };
      }),
    );
  }

  private loadCurrentSession(accessToken: string, refreshToken: string): Observable<UserSession> {
    return this.http.get<SupabaseAuthUser>(`${environment.supabaseUrl}/auth/v1/user`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }),
    }).pipe(switchMap((authUser) => this.loadProfile(authUser, accessToken, refreshToken)));
  }

  initialize(): Observable<boolean> {
    if (this.sessionInitialized) return of(this.isLoggedIn);
    if (this.initialization) return this.initialization;
    if (!environment.isSupabaseConfigured) {
      this.sessionInitialized = true;
      return of(false);
    }

    const accessToken = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refresh_token');
    if (!accessToken) {
      this.sessionInitialized = true;
      this.clearSession();
      return of(false);
    }

    this.initialization = this.loadCurrentSession(accessToken, refreshToken ?? '').pipe(
      catchError((error) => {
        if (error.status === 401 && refreshToken) return this.refreshSession();
        return of(null);
      }),
      map((session) => {
        if (!session || !this.isStaff(session.user)) {
          this.clearSession();
          return false;
        }
        this.saveSession(session);
        return true;
      }),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
      tap(() => { this.sessionInitialized = true; }),
      finalize(() => { this.initialization = undefined; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.initialization;
  }

  login(credentials: { email: string; password: string }): Observable<UserSession> {
    if (!environment.isSupabaseConfigured) return throwError(() => this.configuredError());
    return this.http.post<any>(
      `${environment.supabaseUrl}/auth/v1/token?grant_type=password`,
      credentials,
      { headers: new HttpHeaders({ 'Content-Type': 'application/json', apikey: environment.supabaseAnonKey }) },
    ).pipe(
      switchMap((response) => this.loadProfile(response.user, response.access_token, response.refresh_token)),
      tap((session) => {
        this.saveSession(session);
        this.sessionInitialized = true;
      }),
    );
  }

  refreshSession(): Observable<UserSession> {
    if (!environment.isSupabaseConfigured) return throwError(() => this.configuredError());
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return throwError(() => new Error('Your session has expired. Sign in again.'));
    if (this.refreshInProgress) return this.refreshInProgress;

    this.refreshInProgress = this.http.post<any>(
      `${environment.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      { refresh_token: refreshToken },
      { headers: new HttpHeaders({ 'Content-Type': 'application/json', apikey: environment.supabaseAnonKey }) },
    ).pipe(
      switchMap((response) => this.loadProfile(response.user, response.access_token, response.refresh_token)),
      tap((session) => this.saveSession(session)),
      finalize(() => { this.refreshInProgress = undefined; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInProgress;
  }

  getAllAgents(): Observable<User[]> {
    return this.http.get<SupabaseProfile[]>(`${environment.apiUrl}/profiles`, {
      params: { role: 'eq.agent', select: 'id,full_name,role', order: 'full_name.asc' },
    }).pipe(map((profiles) => profiles.map((profile) => ({
      id: profile.id,
      email: '',
      name: profile.full_name,
      role: profile.role,
    }))));
  }

  logout(): void {
    const accessToken = localStorage.getItem('token');
    this.clearSession();
    this.sessionInitialized = true;
    if (accessToken && environment.isSupabaseConfigured) {
      this.http.post(`${environment.supabaseUrl}/auth/v1/logout`, null, {
        headers: new HttpHeaders({ apikey: environment.supabaseAnonKey, Authorization: `Bearer ${accessToken}` }),
      }).subscribe({ error: () => undefined });
    }
  }
}
