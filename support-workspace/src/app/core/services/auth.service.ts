import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isStaffRole, type LoginCredentials, type User, type UserRole } from '../models';
import { AccountError, describeError } from '../utils/errors';

export const STAFF_ONLY_MESSAGE =
  'This workspace is for support staff. Customers should use the Customer Portal.';
const NOT_SET_UP_MESSAGE = 'Your account is not set up for the Support Workspace yet. Please contact your manager.';

interface TokenResponse {
  access_token: string;
  user: { id: string };
}

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

function signInMessage(error: unknown): string {
  const body = (error as { error?: { error_description?: string; msg?: string } })?.error;
  const detail = `${body?.error_description ?? ''} ${body?.msg ?? ''}`;
  if (/email not confirmed/i.test(detail)) {
    return 'Please confirm your email address first, then sign in.';
  }
  if (/invalid login credentials/i.test(detail)) return 'Invalid email or password. Please try again.';
  if ((error as { status?: number })?.status === 0) {
    return 'We could not reach the sign-in service. Check your connection and try again.';
  }
  return 'We could not sign you in. Please try again.';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private currentUserSubject = new BehaviorSubject<User | null>(this.restoreUser());
  readonly currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /** True when a session exists and it belongs to a staff account. */
  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value && !!localStorage.getItem('token') && this.isStaff;
  }

  get isStaff(): boolean {
    return isStaffRole(this.currentUserSubject.value?.role);
  }

  /**
   * Signs in and reads the role from the users table. Metadata sent by the browser is not
   * used for the role. Customer accounts are refused here and are not stored.
   */
  login(credentials: LoginCredentials): Observable<User> {
    return this.http
      .post<TokenResponse & { access_token: string }>(
        `${environment.supabaseUrl}/auth/v1/token?grant_type=password`,
        { email: credentials.email, password: credentials.password },
        { headers: { 'Content-Type': 'application/json', apikey: environment.supabaseAnonKey } }
      )
      .pipe(
        catchError((error) => throwError(() => new AccountError(signInMessage(error)))),
        switchMap((session) =>
          this.fetchProfile(session.user.id, session.access_token).pipe(
            switchMap((user) => {
              if (!isStaffRole(user.role)) {
                this.revokeToken(session.access_token);
                return throwError(() => new AccountError(STAFF_ONLY_MESSAGE));
              }
              localStorage.setItem('token', session.access_token);
              localStorage.setItem('user', JSON.stringify(user));
              this.currentUserSubject.next(user);
              return of(user);
            })
          )
        )
      );
  }

  /** Staff directory used for assignment and name lookups. Row Level Security limits it to staff. */
  getStaff(): Observable<User[]> {
    return this.http
      .get<ProfileRow[]>(`${environment.apiUrl}/users`, {
        params: { role: 'in.(agent,manager)', select: 'id,email,name,role', order: 'name.asc' },
      })
      .pipe(map((rows) => (Array.isArray(rows) ? rows.map(toUser) : [])));
  }

  getUser(id: string): Observable<User | null> {
    return this.http
      .get<ProfileRow[]>(`${environment.apiUrl}/users`, {
        params: { id: `eq.${id}`, select: 'id,email,name,role' },
      })
      .pipe(map((rows) => (Array.isArray(rows) && rows[0] ? toUser(rows[0]) : null)));
  }

  logout(): void {
    const token = localStorage.getItem('token');
    this.clearSession();
    if (token) this.revokeToken(token);
  }

  /** Clears the local session after the server rejected it (expired or invalid token). */
  expireSession(): void {
    this.clearSession();
  }

  private fetchProfile(userId: string, accessToken: string): Observable<User> {
    return this.http
      .get<ProfileRow[]>(`${environment.apiUrl}/users`, {
        params: { id: `eq.${userId}`, select: 'id,email,name,role' },
        headers: { apikey: environment.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
      })
      .pipe(
        map((rows) => {
          const row = Array.isArray(rows) ? rows[0] : undefined;
          if (!row) throw new AccountError(NOT_SET_UP_MESSAGE);
          return toUser(row);
        }),
        catchError((error) =>
          throwError(() => (error instanceof AccountError ? error : new AccountError(describeError(error, NOT_SET_UP_MESSAGE))))
        )
      );
  }

  private revokeToken(accessToken: string): void {
    // Best effort: a failed sign-out call does not block the user.
    this.http
      .post(`${environment.supabaseUrl}/auth/v1/logout`, {}, {
        headers: { apikey: environment.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
      })
      .subscribe({ error: () => undefined });
  }

  private clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  /** Restores the stored user. Customer or malformed sessions are discarded. */
  private restoreUser(): User | null {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
      const user = JSON.parse(stored) as User;
      if (!user?.id || !isStaffRole(user.role)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
      }
      return user;
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
  }
}

function toUser(row: ProfileRow): User {
  return { id: row.id, email: row.email, name: row.name || row.email, role: row.role };
}
