import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { describeApiError, NotFoundError, ConflictError, AccountError } from '../api/errors';

function httpError(status: number, data: unknown): AxiosError {
  return new AxiosError('failed', 'ERR', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
  } as never);
}

const FALLBACK = 'Something went wrong.';

describe('describeApiError', () => {
  it('shows readable rule messages raised by the database', () => {
    const error = httpError(400, { code: 'P0001', message: 'Customers can only reopen a resolved request' });
    expect(describeApiError(error, FALLBACK)).toBe('Customers can only reopen a resolved request');
  });

  it('hides technical permission errors behind a plain message', () => {
    const error = httpError(403, { code: '42501', message: 'new row violates row-level security policy for table "messages"' });
    expect(describeApiError(error, FALLBACK)).toBe('You do not have permission to do this.');
  });

  it('explains an expired session', () => {
    expect(describeApiError(httpError(401, {}), FALLBACK)).toMatch(/session has expired/i);
  });

  it('explains a network failure', () => {
    const offline = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(describeApiError(offline, FALLBACK)).toMatch(/could not reach the server/i);
  });

  it('keeps messages of app-level errors and uses the fallback for anything else', () => {
    expect(describeApiError(new NotFoundError(), FALLBACK)).toMatch(/not found/i);
    expect(describeApiError(new ConflictError('Changed elsewhere.'), FALLBACK)).toBe('Changed elsewhere.');
    expect(describeApiError(new AccountError('Sign-in failed.'), FALLBACK)).toBe('Sign-in failed.');
    expect(describeApiError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
  });
});
