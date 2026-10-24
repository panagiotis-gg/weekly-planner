import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/config';
import { APP_CONFIG } from '../config/config.module';

/** Structured JSON logs to stdout (DECISIONS G1); pretty-printed in development. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        // Express 5 wildcard syntax (nestjs-pino's default "*" triggers a deprecation warning in Nest 11).
        forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.LOG_LEVEL,
          transport:
            config.NODE_ENV === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const header = req.headers['x-request-id'];
            const id = typeof header === 'string' && header.length <= 128 ? header : randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          // Never log credentials or tokens.
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          autoLogging: { ignore: (req: IncomingMessage) => req.url === '/healthz' },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
