import type { ApiErrorCode } from '@cta/shared';

/** Throw from a service or route to send a structured error response. */
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: ApiErrorCode,
        message: string,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', message, details);
export const notFound = (resource: string) => new HttpError(404, 'NOT_FOUND', `${resource} not found`);
