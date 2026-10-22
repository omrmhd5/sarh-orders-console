export class ApiError extends Error {
  status: number;
  errors: string[];

  constructor(status: number, message: string, errors: string[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    let message = 'The request failed';
    let errors: string[] = [];
    try {
      const body = (await response.json()) as { error?: string; errors?: unknown };
      if (Array.isArray(body.errors)) {
        errors = body.errors.filter((item): item is string => typeof item === 'string');
      }
      if (typeof body.error === 'string') message = body.error;
      else if (errors[0]) message = errors[0];
    } catch {
      // The status is the useful part when the body is empty.
    }
    throw new ApiError(response.status, message, errors);
  }
  return response.json() as Promise<T>;
}
