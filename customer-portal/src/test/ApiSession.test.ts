import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter } from 'axios';
import apiClient from '../api/axios';

vi.mock('../config/supabase', () => ({
  assertSupabaseConfigured: vi.fn(),
  supabaseConfig: {
    url: 'https://support.test',
    authUrl: 'https://support.test/auth/v1',
    restUrl: 'https://support.test/rest/v1',
    storageUrl: 'https://support.test/storage/v1',
    anonKey: 'public-anon-key',
    isConfigured: true,
  },
}));

describe('Supabase API session handling', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/login');
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('does not erase a valid session when RLS returns forbidden', async () => {
    localStorage.setItem('token', 'customer-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'customer' }));
    const adapter: AxiosAdapter = async (config) => Promise.reject({ config, response: { status: 403 } });

    await expect(apiClient.get('/requests', { adapter })).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBe('customer-token');
    expect(localStorage.getItem('user')).not.toBeNull();
  });

  it('clears an expired session when no refresh token is available', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'customer' }));
    const adapter: AxiosAdapter = async (config) => Promise.reject({ config, response: { status: 401 } });

    await expect(apiClient.get('/requests', { adapter })).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
