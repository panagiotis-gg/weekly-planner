import { writeSync } from 'node:fs';

/** Gives pino's asynchronous stdout writes time to flush before the process exits. */
const FLUSH_GRACE_MS = 250;

/**
 * Start-up failure handler for main.ts / worker.ts. The fatal line is written synchronously
 * (JSON, like the rest of the logs), so it survives the exit even if the logger never flushed.
 */
export function fatalExit(context: string, err: unknown): void {
  // AggregateError (e.g. ECONNREFUSED on IPv4 + IPv6) has an empty message; keep its code.
  const error =
    err instanceof Error
      ? { message: err.message, code: (err as NodeJS.ErrnoException).code, stack: err.stack }
      : { message: String(err) };
  writeSync(2, `${JSON.stringify({ level: 'fatal', time: Date.now(), context, msg: `${context} failed`, err: error })}\n`);
  setTimeout(() => process.exit(1), FLUSH_GRACE_MS);
}
