import type { ApiErrorBody, ApiErrorCode } from '@cta/shared';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

/** Thrown for any non-2xx response or network failure. */
export class ApiError extends Error {
    readonly status: number;
    readonly code: ApiErrorCode | 'NETWORK_ERROR';
    readonly details?: unknown;

    constructor(message: string, status: number, code: ApiErrorCode | 'NETWORK_ERROR', details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }

    /** Field-level messages from a VALIDATION_ERROR response. */
    get fieldErrors(): { path: string; message: string }[] {
        return this.code === 'VALIDATION_ERROR' && Array.isArray(this.details) ? this.details : [];
    }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = { method };
    if (body instanceof FormData) {
        init.body = body;
    } else if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json' };
    }

    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, init);
    } catch {
        throw new ApiError('Could not reach the server. Is it running?', 0, 'NETWORK_ERROR');
    }

    if (res.status === 204) return undefined as T;

    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        const err = (payload as ApiErrorBody | null)?.error;
        throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code ?? 'INTERNAL_ERROR', err?.details);
    }
    return payload as T;
}

/** Human-readable message for any error, for alerts and inline error text. */
export function errorMessage(err: unknown): string {
    if (err instanceof ApiError) {
        const fields = err.fieldErrors.map(f => `${f.path}: ${f.message}`);
        return fields.length ? `${err.message}\n${fields.join('\n')}` : err.message;
    }
    return err instanceof Error ? err.message : String(err);
}
