import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { login, register, fetchProfile } from '../api/auth';
import { AccountError } from '../api/errors';

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn() } };
});

vi.mock('../api/axios', () => ({
  authHeaders: () => ({}),
  getAccessToken: () => null,
  clearSession: vi.fn(),
  SESSION_TOKEN_KEY: 'token',
  SESSION_USER_KEY: 'user',
  default: {},
}));

async function http() {
  return (await import('axios')).default as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
}

function authError(body: unknown): AxiosError {
  return new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    data: body,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as never);
}

describe('account handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('takes the role from the users table, not from the sign-in metadata', async () => {
    const api = await http();
    api.post.mockResolvedValueOnce({ data: { access_token: 'tok', user: { id: 'u1', email: 'a@x.com', user_metadata: { role: 'customer' } } } });
    api.get.mockResolvedValueOnce({ data: [{ id: 'u1', email: 'a@x.com', name: 'Agent One', role: 'agent' }] });

    const user = await login({ email: 'a@x.com', password: 'pw' });

    expect(user.role).toBe('agent');
    expect(user.accessToken).toBe('tok');
    expect(api.get.mock.calls[0][1]).toMatchObject({ params: { id: 'eq.u1', select: 'id,email,name,role' } });
  });

  it('reports a wrong password in plain language', async () => {
    const api = await http();
    api.post.mockRejectedValueOnce(authError({ error_description: 'Invalid login credentials' }));

    await expect(login({ email: 'a@x.com', password: 'bad' })).rejects.toThrow(/invalid email or password/i);
  });

  it('asks for email confirmation when the account is not confirmed', async () => {
    const api = await http();
    api.post.mockRejectedValueOnce(authError({ msg: 'Email not confirmed' }));

    await expect(login({ email: 'a@x.com', password: 'pw' })).rejects.toThrow(/confirm your email/i);
  });

  it('refuses an account that has no profile row', async () => {
    const api = await http();
    api.get.mockResolvedValueOnce({ data: [] });

    await expect(fetchProfile('missing', 'tok')).rejects.toBeInstanceOf(AccountError);
  });

  it('signs up without sending any role, and reports when confirmation is pending', async () => {
    const api = await http();
    api.post.mockResolvedValueOnce({ data: { id: 'new', email: 'n@x.com' } });

    const result = await register({ email: 'n@x.com', password: 'longpassword', name: 'New Person' });

    expect(result).toEqual({ needsConfirmation: true });
    const body = api.post.mock.calls[0][1] as { data: Record<string, unknown> };
    expect(body.data).toEqual({ full_name: 'New Person' });
    expect(JSON.stringify(body)).not.toMatch(/role/);
  });

  it('returns the customer when sign-up creates a session right away', async () => {
    const api = await http();
    api.post.mockResolvedValueOnce({ data: { access_token: 'tok2', user: { id: 'n1' } } });
    api.get.mockResolvedValueOnce({ data: [{ id: 'n1', email: 'n@x.com', name: 'New Person', role: 'customer' }] });

    const result = await register({ email: 'n@x.com', password: 'longpassword', name: 'New Person' });

    expect(result.needsConfirmation).toBe(false);
    expect(result.user).toMatchObject({ id: 'n1', role: 'customer', accessToken: 'tok2' });
  });
});
