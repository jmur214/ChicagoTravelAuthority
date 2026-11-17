import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@cta/shared';
import { HttpError } from '../lib/httpError';

const send = (res: Parameters<ErrorRequestHandler>[2], status: number, body: ApiErrorBody) => res.status(status).json(body);

/** Translate any thrown error into the standard `{ error: { code, message, details? } }` envelope. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
        return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
    }

    if (err instanceof ZodError) {
        return send(res, 400, {
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
            },
        });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2025': // record to update/delete not found
                return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Resource not found' } });
            case 'P2002': // unique constraint
                return send(res, 409, {
                    error: { code: 'CONFLICT', message: 'A record with that value already exists', details: err.meta?.target },
                });
            case 'P2003': // foreign key (e.g. unknown tag/category id)
                return send(res, 400, { error: { code: 'BAD_REQUEST', message: 'Referenced record does not exist' } });
        }
    }

    if (err instanceof MulterError) {
        return send(res, 400, { error: { code: 'BAD_REQUEST', message: err.message } });
    }

    // Malformed JSON body from express.json()
    if (err?.type === 'entity.parse.failed') {
        return send(res, 400, { error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    }

    console.error('[unhandled]', err);
    return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};

export const notFoundHandler: RequestHandler = (req, res) => {
    send(res, 404, { error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};
