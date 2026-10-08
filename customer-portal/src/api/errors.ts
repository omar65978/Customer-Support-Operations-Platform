import { isAxiosError } from "axios";

/** The record does not exist or is not visible to the signed-in user. */
export class NotFoundError extends Error {
  constructor(message = "This request was not found, or you do not have access to it.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** The record changed since it was loaded, so the action was not applied. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Sign-in or account problem that the user can act on. The message is safe to show. */
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

/** Input that failed a rule before it was sent. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const PERMISSION_MESSAGE = "You do not have permission to do this.";

/**
 * Turns an API error into a message for the user. Database rules raise readable messages
 * (for example "Customers can only reopen a resolved request"), which are shown as they are.
 * Technical details are replaced by the fallback text.
 */
export function describeApiError(error: unknown, fallback: string): string {
  if (
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof AccountError ||
    error instanceof ValidationError
  ) {
    return error.message;
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return "We could not reach the server. Check your connection and try again.";
    }
    const status = error.response.status;
    const body = error.response.data as { message?: unknown } | undefined;
    const message = typeof body?.message === "string" ? body.message : "";
    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403 || /row-level security|permission denied/i.test(message)) return PERMISSION_MESSAGE;
    if (message && status >= 400 && status < 500) return message;
  }
  return fallback;
}
