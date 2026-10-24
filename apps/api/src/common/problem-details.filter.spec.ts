import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createZodDto, ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { ProblemDetailsFilter } from './problem-details.filter';

describe('ProblemDetailsFilter', () => {
  const filter = new ProblemDetailsFilter();

  it('maps HttpExceptions to a code derived from the status', () => {
    expect(filter.toProblem(new NotFoundException())).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('keeps an explicit code, detail and extra members', () => {
    const p = filter.toProblem(
      new ServiceUnavailableException({ code: 'NOT_READY', detail: 'Dependencies unavailable', checks: { redis: 'down' } }),
    );
    expect(p).toMatchObject({ status: 503, code: 'NOT_READY', detail: 'Dependencies unavailable', checks: { redis: 'down' } });
    expect(p).not.toHaveProperty('statusCode');
  });

  it('uses the message as detail', () => {
    expect(filter.toProblem(new ForbiddenException('Viewers cannot edit'))).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      detail: 'Viewers cannot edit',
    });
  });

  it('maps Zod validation errors to 422 with field paths', () => {
    class Dto extends createZodDto(z.object({ title: z.string().max(3) })) {}
    const result = Dto.schema.safeParse({ title: 'too long' });
    if (result.success) throw new Error('expected failure');
    const p = filter.toProblem(new ZodValidationException(result.error));
    expect(p.status).toBe(422);
    expect(p.code).toBe('VALIDATION_FAILED');
    expect(p.errors).toEqual([{ path: 'title', message: expect.any(String) }]);
  });

  it('hides unexpected errors behind a generic 500', () => {
    expect(filter.toProblem(new Error('db password leaked in message'))).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'Unexpected error',
    });
  });
});
