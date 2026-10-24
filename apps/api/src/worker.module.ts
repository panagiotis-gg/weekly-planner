import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { LoggingModule } from './logging/logging.module';
import { RedisModule } from './redis/redis.module';

/**
 * Worker process: email queue, account purge, token/invite clean-up, tombstone compaction
 * (architecture §3). Job modules plug in here.
 */
@Module({
  imports: [ConfigModule, LoggingModule, DatabaseModule, RedisModule],
})
export class WorkerModule {}
