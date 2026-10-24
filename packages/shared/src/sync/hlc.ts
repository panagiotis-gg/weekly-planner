/**
 * Hybrid logical clock (architecture §5.2).
 *
 * Stamp format: `<13-digit ms>:<4-hex counter>:<nodeId>`. Stamps compare lexicographically in
 * causal order, and the node ID makes ties impossible between different devices.
 */

export const HLC_REGEX = /^\d{13}:[0-9a-f]{4}:[A-Za-z0-9_-]{1,64}$/;
export const NODE_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_COUNTER = 0xffff;
/** Remote stamps further ahead of the local wall clock than this are rejected. */
export const DEFAULT_MAX_DRIFT_MS = 24 * 60 * 60 * 1000;

export interface HlcState {
  ms: number;
  counter: number;
  nodeId: string;
}

export interface ParsedHlc {
  ms: number;
  counter: number;
  nodeId: string;
}

export class HlcError extends Error {}

export function createHlc(nodeId: string): HlcState {
  if (!NODE_ID_REGEX.test(nodeId)) throw new HlcError(`Invalid HLC node id: ${nodeId}`);
  return { ms: 0, counter: 0, nodeId };
}

export function formatHlc(ms: number, counter: number, nodeId: string): string {
  return `${String(ms).padStart(13, '0')}:${counter.toString(16).padStart(4, '0')}:${nodeId}`;
}

export function parseHlc(stamp: string): ParsedHlc {
  if (!HLC_REGEX.test(stamp)) throw new HlcError(`Invalid HLC stamp: ${stamp}`);
  const [ms, counter, nodeId] = stamp.split(':') as [string, string, string];
  return { ms: Number(ms), counter: parseInt(counter, 16), nodeId };
}

export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function checkCounter(counter: number): number {
  if (counter > MAX_COUNTER) throw new HlcError('HLC counter overflow');
  return counter;
}

/** Advance the clock for a local event and return the new state plus its stamp. */
export function tick(state: HlcState, now: number = Date.now()): [HlcState, string] {
  const ms = Math.max(state.ms, now);
  const counter = checkCounter(ms === state.ms ? state.counter + 1 : 0);
  const next = { ms, counter, nodeId: state.nodeId };
  return [next, formatHlc(ms, counter, state.nodeId)];
}

/** Merge a remote stamp into the local clock so later local stamps sort after it. */
export function receive(
  state: HlcState,
  remote: string,
  now: number = Date.now(),
  maxDriftMs: number = DEFAULT_MAX_DRIFT_MS,
): HlcState {
  const r = parseHlc(remote);
  if (r.ms - now > maxDriftMs) throw new HlcError(`Remote clock too far ahead: ${remote}`);
  const ms = Math.max(state.ms, r.ms, now);
  let counter: number;
  if (ms === state.ms && ms === r.ms) counter = Math.max(state.counter, r.counter) + 1;
  else if (ms === state.ms) counter = state.counter + 1;
  else if (ms === r.ms) counter = r.counter + 1;
  else counter = 0;
  return { ms, counter: checkCounter(counter), nodeId: state.nodeId };
}
