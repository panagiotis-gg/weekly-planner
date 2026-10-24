import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProblemDetailsFilter } from '../src/common/problem-details.filter';
import { PG_POOL } from '../src/database/database.tokens';
import { HealthController } from '../src/health/health.controller';
import { REDIS } from '../src/redis/redis.module';

describe('health endpoints', () => {
  let app: INestApplication;
  const pool = { query: jest.fn() };
  const redis = { ping: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PG_POOL, useValue: pool },
        { provide: REDIS, useValue: redis },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    redis.ping.mockResolvedValue('PONG');
  });

  it('GET /healthz returns ok', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200, { status: 'ok' });
  });

  it('GET /readyz reports dependencies up', async () => {
    const res = await request(app.getHttpServer()).get('/readyz').expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('GET /readyz returns 503 problem+json when Redis is down', async () => {
    redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app.getHttpServer()).get('/readyz').expect(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ code: 'NOT_READY', checks: { database: 'up', redis: 'down' } });
  });
});
