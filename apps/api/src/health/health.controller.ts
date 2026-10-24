import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { REDIS } from '../redis/redis.module';

type CheckResult = 'up' | 'down';

const CHECK_TIMEOUT_MS = 2000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: the process is up. */
  @Get('healthz')
  @HttpCode(200)
  liveness() {
    return { status: 'ok' };
  }

  /** Readiness: PostgreSQL and Redis reachable (migrations run before the server listens). */
  @Get('readyz')
  async readiness() {
    const [database, redis] = await Promise.all([
      this.check(() => this.pool.query('SELECT 1')),
      this.check(() => this.redis.ping()),
    ]);
    const checks = { database, redis };
    if (database === 'down' || redis === 'down') {
      throw new ServiceUnavailableException({ code: 'NOT_READY', detail: 'Dependencies unavailable', checks });
    }
    return { status: 'ok', checks };
  }

  private async check(fn: () => Promise<unknown>): Promise<CheckResult> {
    try {
      await withTimeout(fn());
      return 'up';
    } catch {
      return 'down';
    }
  }
}
