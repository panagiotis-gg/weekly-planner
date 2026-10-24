import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  /** Stable machine-readable code the app maps to a localised message. */
  code: string;
  detail?: string;
  errors?: { path: string; message: string }[];
  requestId?: string;
  [extra: string]: unknown;
}

/** Every error leaves the API as RFC 9457 application/problem+json (api-design.md §1). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    const problem = this.toProblem(exception);
    problem.requestId = req.id;

    if (problem.status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      Sentry.captureException(exception);
    }
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      return this.base(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', {
        detail: 'The request is invalid',
        errors: zodError.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
      });
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const { code, detail, message, error: _error, statusCode: _statusCode, ...extra } = body as Record<string, unknown>;
        return this.base(status, typeof code === 'string' ? code : this.codeFor(status), {
          detail: typeof detail === 'string' ? detail : typeof message === 'string' ? message : undefined,
          ...extra,
        });
      }
      return this.base(status, this.codeFor(status), { detail: String(body) });
    }
    return this.base(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', { detail: 'Unexpected error' });
  }

  private base(status: number, code: string, rest: Partial<ProblemDetails>): ProblemDetails {
    return { type: 'about:blank', title: STATUS_CODES[status] ?? 'Error', status, code, ...rest };
  }

  private codeFor(status: number): string {
    return (HttpStatus[status] as string | undefined) ?? 'ERROR';
  }
}
