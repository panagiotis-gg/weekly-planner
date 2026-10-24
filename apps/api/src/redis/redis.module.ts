import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/config';
import { APP_CONFIG } from '../config/config.module';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        // maxRetriesPerRequest: null is required by BullMQ, which will share this connection config.
        const client = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
        // ioredis reconnects on its own; log instead of crashing on an unhandled 'error' event.
        const logger = new Logger('Redis');
        client.on('error', (err: NodeJS.ErrnoException) =>
          logger.warn(`Redis connection error: ${err.code ?? err.message}`),
        );
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
