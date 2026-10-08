import { HttpErrorResponse } from '@angular/common/http';

/** The record does not exist or is not visible to the signed-in user. */
export class NotFoundError extends Error {
  constructor(message = 'This request was not found, or you do not have access to it.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** The record changed since it was loaded, so the action was not applied. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Sign-in or account problem the user can act on. The message is safe to show. */
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

/** Input refused before it was sent. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const PERMISSION_MESSAGE = 'You do not have permission to do this.';

/**
 * Turns an error into text for the user. Readable database rule messages (for example
 * "Only managers can reassign a request") are shown as they are. Technical details are replaced.
 */
export function describeError(error: unknown, fallback: string): string {
  if (
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof AccountError ||
    error instanceof ValidationError
  ) {
    return error.message;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'We could not reach the server. Check your connection and try again.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return PERMISSION_MESSAGE;
    const body = error.error as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : '';
    if (/row-level security|permission denied/i.test(message)) return PERMISSION_MESSAGE;
    if (message && error.status >= 400 && error.status < 500) return message;
  }
  return fallback;
}
