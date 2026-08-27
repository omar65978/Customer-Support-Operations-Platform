import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private http: HttpClient) {}

  login(credentials: { email: string; password: string }): Observable<any> {
    const url = `${environment.supabaseUrl}/auth/v1/token?grant_type=password`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'apikey': environment.supabaseKey
    });

    return this.http.post<any>(url, credentials, { headers }).pipe(
      tap(res => {
        if (res.access_token) {
          localStorage.setItem('token', res.access_token);
          localStorage.setItem('user', JSON.stringify(res.user));
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}